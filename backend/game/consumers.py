"""
WebSocket consumers for real-time game communication.
"""

import json
import math
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import IntegrityError, transaction
from django.contrib.auth import get_user_model
from .models import Lobby, LobbyMember, PlayerPosition, ChatMessage

User = get_user_model()

_ACTIVITIES = {value for value, _label in PlayerPosition.ACTIVITY_CHOICES}
# Long enough for the ids the campus generates ("lecture-5-8", "cafe-11.5-13-0.8-1.4")
# and short enough that the column cannot be used as free storage.
_MAX_SEAT_ID = 48


def _clean_heading(value):
    """
    A finite angle, or zero.

    The client sends this every frame, so a NaN reaching the database is a row
    that then breaks every consumer serialising it — and JSON has no NaN, so it
    arrives as a string or null rather than as a number.
    """
    try:
        angle = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(angle):
        return 0.0
    # Normalised to (-pi, pi], so the value cannot drift without bound as a
    # player spins on the spot.
    return math.remainder(angle, 2 * math.pi)


def _clean_activity(value):
    """One of the poses we know, or standing. Never whatever the client sent."""
    return value if value in _ACTIVITIES else PlayerPosition.STANDING


def _clean_seat(value):
    """A seat id, or None. Bounded, because it is client-supplied text."""
    if not isinstance(value, str):
        return None
    seat = value.strip()
    if not seat or len(seat) > _MAX_SEAT_ID:
        return None
    return seat


class LobbyConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for handling real-time lobby communication.
    Supports player movement updates, chat messages, and lobby state changes.
    """
    
    async def connect(self):
        """Accept WebSocket connection and add user to lobby group."""
        self.lobby_id = self.scope['url_route']['kwargs']['lobby_id']
        self.lobby_group_name = f'lobby_{self.lobby_id}'
        self.user = self.scope["user"]
        
        print(f"WebSocket connection attempt - Lobby: {self.lobby_id}, User: {self.user}")
        
        # Check if user is authenticated
        if not self.user.is_authenticated:
            print(f"User not authenticated: {self.user}")
            await self.close(code=4001)
            return
            
        # Check if lobby exists and user is a member
        lobby_exists = await self.check_lobby_membership()
        print(f"User {self.user.username} is member of lobby {self.lobby_id}: {lobby_exists}")
        if not lobby_exists:
            await self.close(code=4003)
            return

        # Join lobby group
        await self.channel_layer.group_add(
            self.lobby_group_name,
            self.channel_name
        )

        await self.accept()
        print(f"WebSocket connected for user {self.user.username} to lobby {self.lobby_id}")

        # Send initial lobby state
        await self.send_lobby_state()

        # Notify other users that someone joined
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'user_joined',
                'user_id': self.user.id,
                'username': self.user.username,
            }
        )

    async def disconnect(self, code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'lobby_group_name'):
            # Give up the chair. A seat is held by exactly one player, so a
            # player who closes the tab while sitting would otherwise hold it
            # against everyone else for the life of the lobby.
            await self.release_seat()

            # Notify other users that someone left
            await self.channel_layer.group_send(
                self.lobby_group_name,
                {
                    'type': 'user_left',
                    'user_id': self.user.id,
                    'username': self.user.username,
                }
            )
            
            # Leave lobby group
            await self.channel_layer.group_discard(
                self.lobby_group_name,
                self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming WebSocket messages."""
        try:
            payload = text_data if text_data is not None else (bytes_data.decode('utf-8') if bytes_data else '')
            data = json.loads(payload)
            message_type = data.get('type')
            
            if message_type == 'player_position':
                await self.handle_player_position(data)
            elif message_type == 'take_seat':
                await self.handle_take_seat(data)
            elif message_type == 'leave_seat':
                await self.handle_leave_seat(data)
            elif message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'study_room_join':
                await self.handle_study_room_join(data)
            elif message_type == 'study_room_leave':
                await self.handle_study_room_leave(data)
            else:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))

    async def handle_player_position(self, data):
        """Handle player position updates."""
        # These are the fields PlayerPosition actually has, and the ones the
        # client sends. The previous z/rotation_* keys existed on neither, so
        # direction, is_moving and current_room were dropped from every update:
        # remote players never animated, never faced the right way, and room
        # presence never propagated.
        position_data = {
            'x': data.get('x', 0),
            'y': data.get('y', 0),
            'direction': data.get('direction', 'down'),
            'heading': _clean_heading(data.get('heading')),
            'activity': _clean_activity(data.get('activity')),
            'is_moving': data.get('is_moving', False),
            'current_room': data.get('current_room'),
        }
        
        # Update player position in database
        await self.update_player_position(position_data)
        
        # Broadcast position update to other users in lobby
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'position_update',
                'user_id': self.user.id,
                'username': self.user.username,
                'full_name': self.user.get_full_name() or self.user.username,  # Fallback to username if full_name is empty
                'position': position_data,
            }
        )

    async def handle_take_seat(self, data):
        """
        Claim a seat, if nobody else has it.

        The decision is made here rather than in the browser for the same
        reason the LiveKit permissions are: a client that decides for itself
        whether a chair is free is a client that can be modified not to ask.
        Two people in one chair is only cosmetic, but the same reasoning
        applies to anything the world holds on a player's behalf.
        """
        seat = _clean_seat(data.get('seat'))
        if not seat:
            await self.send(text_data=json.dumps({'type': 'seat_denied', 'seat': None}))
            return

        taken = await self.claim_seat(seat)
        if not taken:
            # Somebody got there first. The client puts the player back on
            # their feet rather than leaving them sitting in mid-air.
            await self.send(text_data=json.dumps({'type': 'seat_denied', 'seat': seat}))
            return

        await self.broadcast_seating(seat, PlayerPosition.SITTING)

    async def handle_leave_seat(self, data):
        """Stand up, releasing the seat for whoever wants it next."""
        await self.release_seat()
        await self.broadcast_seating(None, PlayerPosition.STANDING)

    async def broadcast_seating(self, seat, activity):
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'seat_update',
                'user_id': self.user.id,
                'seat': seat,
                'activity': activity,
            }
        )

    async def seat_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'seat_update',
            'user_id': event['user_id'],
            'seat': event['seat'],
            'activity': event['activity'],
        }))

    @database_sync_to_async
    def claim_seat(self, seat):
        """
        Takes the seat, or reports that it is occupied.

        The unique constraint is the authority, not a prior read: two players
        pressing the key in the same tick both see an empty chair, and only the
        database can decide between them.
        """
        try:
            with transaction.atomic():
                position, _ = PlayerPosition.objects.get_or_create(
                    user=self.user, lobby_id=self.lobby_id
                )
                if PlayerPosition.objects.filter(
                    lobby_id=self.lobby_id, seat=seat
                ).exclude(pk=position.pk).exists():
                    return False
                position.seat = seat
                position.activity = PlayerPosition.SITTING
                position.save(update_fields=['seat', 'activity', 'last_updated'])
                return True
        except IntegrityError:
            return False

    @database_sync_to_async
    def release_seat(self):
        PlayerPosition.objects.filter(user=self.user, lobby_id=self.lobby_id).update(
            seat=None, activity=PlayerPosition.STANDING
        )

    async def handle_chat_message(self, data):
        """Handle chat messages."""
        message = data.get('message', '').strip()
        if not message:
            return
            
        # Save chat message to database
        chat_message = await self.save_chat_message(message)
        
        # Broadcast chat message to all users in lobby
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'chat_message',
                'message_id': chat_message.id,
                'user_id': self.user.id,
                'username': self.user.username,
                'message': message,
                'timestamp': chat_message.created_at.isoformat(),
            }
        )

    async def handle_study_room_join(self, data):
        """Handle study room join events."""
        room_id = data.get('room_id')
        if room_id:
            await self.channel_layer.group_send(
                self.lobby_group_name,
                {
                    'type': 'study_room_join',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'room_id': room_id,
                }
            )

    async def handle_study_room_leave(self, data):
        """Handle study room leave events."""
        room_id = data.get('room_id')
        if room_id:
            await self.channel_layer.group_send(
                self.lobby_group_name,
                {
                    'type': 'study_room_leave',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'room_id': room_id,
                }
            )

    # Group message handlers
    async def user_joined(self, event):
        """Handle user joined event."""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def user_left(self, event):
        """Handle user left event."""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def position_update(self, event):
        """Handle position update event."""
        # Don't send position updates back to the sender
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'position_update',
                'user_id': event['user_id'],
                'username': event['username'],
                'full_name': event.get('full_name', event['username']),  # Include full_name, fallback to username
                'position': event['position'],
            }))

    async def chat_message(self, event):
        """Handle chat message event."""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message_id': event['message_id'],
            'user_id': event['user_id'],
            'username': event['username'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))

    async def study_room_join(self, event):
        """Handle study room join event."""
        await self.send(text_data=json.dumps({
            'type': 'study_room_join',
            'user_id': event['user_id'],
            'username': event['username'],
            'room_id': event['room_id'],
        }))

    async def study_room_leave(self, event):
        """Handle study room leave event."""
        await self.send(text_data=json.dumps({
            'type': 'study_room_leave',
            'user_id': event['user_id'],
            'username': event['username'],
            'room_id': event['room_id'],
        }))

    # Database operations
    @database_sync_to_async
    def check_lobby_membership(self):
        """Check if the lobby exists and user is a member."""
        try:
            # Lobby model uses `id` as the primary key (8-digit string)
            lobby = Lobby.objects.get(id=self.lobby_id)
            return LobbyMember.objects.filter(lobby=lobby, user=self.user).exists()
        except Lobby.DoesNotExist:
            return False

    @database_sync_to_async
    def update_player_position(self, position_data):
        """Update player position in the database."""
        try:
            lobby = Lobby.objects.get(id=self.lobby_id)
            # Only accept the PlayerPosition fields that actually exist on the model
            allowed = {'x', 'y', 'direction', 'heading', 'activity', 'is_moving', 'current_room'}
            defaults = {k: v for k, v in position_data.items() if k in allowed}

            # `seat` is deliberately not in that set. It is claimed and released
            # through take_seat/leave_seat, where the occupancy rule is applied;
            # letting a position frame set it would route around the check.
            # For the same reason a position frame cannot stand someone up: a
            # player holding a seat stays sitting until they ask to leave it,
            # or the movement they are already sending would cancel it sixty
            # times a second.
            position = PlayerPosition.objects.filter(lobby=lobby, user=self.user).first()
            if position and position.seat and defaults.get('activity') == PlayerPosition.STANDING:
                defaults['activity'] = PlayerPosition.SITTING
                # And in the payload the caller broadcasts. `defaults` is a
                # filtered copy, so correcting only that stored the player as
                # sitting and announced them to every peer as standing: the
                # avatar left the chair everywhere while the server still held
                # the seat.
                position_data['activity'] = PlayerPosition.SITTING

            # Reuse the row rather than letting update_or_create fetch it a
            # second time. Position frames arrive ten times a second per
            # player, so this is the hot path.
            if position is None:
                return PlayerPosition.objects.create(lobby=lobby, user=self.user, **defaults)

            for field, value in defaults.items():
                setattr(position, field, value)
            position.save(update_fields=[*defaults, 'last_updated'])
            return position
        except Lobby.DoesNotExist:
            return None

    @database_sync_to_async
    def save_chat_message(self, message):
        """Save chat message to the database."""
        try:
            lobby = Lobby.objects.get(id=self.lobby_id)
            chat_message = ChatMessage.objects.create(
                lobby=lobby,
                user=self.user,
                message=message
            )
            return chat_message
        except Lobby.DoesNotExist:
            return None

    @database_sync_to_async
    def get_lobby_state(self):
        """Get current lobby state including active players and recent messages."""
        try:
            lobby = Lobby.objects.get(id=self.lobby_id)
            
            # Get active members
            members = list(LobbyMember.objects.filter(lobby=lobby).select_related('user'))
            
            # Get player positions
            positions = list(PlayerPosition.objects.filter(lobby=lobby).select_related('user'))
            
            # Get recent chat messages (last 50)
            messages = list(ChatMessage.objects.filter(lobby=lobby).select_related('user').order_by('-created_at')[:50])
            
            return {
                'lobby': lobby,
                'members': members,
                'positions': positions,
                'messages': messages,
            }
        except Lobby.DoesNotExist:
            return None

    async def send_lobby_state(self):
        """Send initial lobby state to the connected user."""
        lobby_state = await self.get_lobby_state()
        if not lobby_state:
            return
            
        # Format members
        members = [
            {
                'user_id': member.user.id,
                'username': member.user.username,
                # LobbyMember model doesn't have is_host; compute from lobby.host
                'is_host': member.user.id == lobby_state['lobby'].host_id,
                'joined_at': member.joined_at.isoformat(),
            }
            for member in lobby_state['members']
        ]
        
        # Format positions
        positions = [
            {
                'user_id': position.user.id,
                'username': position.user.username,
                'full_name': position.user.get_full_name() or position.user.username,  # Fallback to username if full_name is empty
                'x': position.x,
                'y': position.y,
                'direction': getattr(position, 'direction', None),
                'heading': getattr(position, 'heading', 0.0),
                'activity': getattr(position, 'activity', PlayerPosition.STANDING),
                'seat': getattr(position, 'seat', None),
                'is_moving': getattr(position, 'is_moving', False),
                # The room the player is standing in. Left out of this snapshot
                # while `position_update` sent it all along, so someone joining
                # a lobby learned where everybody was but not who was indoors.
                # A screen share is drawn on the projector of the presenter's
                # room, so arriving mid-presentation showed a blank screen
                # until the presenter happened to take a step.
                'current_room': position.current_room,
                'last_updated': position.last_updated.isoformat(),
            }
            for position in lobby_state['positions']
        ]
        
        # Format messages (reverse to get chronological order)
        messages = [
            {
                'message_id': message.id,
                'user_id': message.user.id,
                'username': message.user.username,
                'message': message.message,
                'timestamp': message.created_at.isoformat(),
            }
            for message in reversed(lobby_state['messages'])
        ]
        
        await self.send(text_data=json.dumps({
            'type': 'lobby_state',
            'lobby': {
                'id': lobby_state['lobby'].id,
                'name': lobby_state['lobby'].name,
                'description': lobby_state['lobby'].description,
                'max_players': lobby_state['lobby'].max_players,
                'is_private': lobby_state['lobby'].is_private,
                'created_at': lobby_state['lobby'].created_at.isoformat(),
            },
            'members': members,
            'positions': positions,
            'messages': messages,
        }))
