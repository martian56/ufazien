"""
WebSocket consumers for real-time game communication.
"""

import json
import logging
import math
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import IntegrityError, transaction
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import (
    CampusProp,
    LiftCar,
    ChatMessage,
    Lobby,
    LobbyMember,
    PlayerPosition,
    RoomLight,
)

User = get_user_model()

logger = logging.getLogger(__name__)

_ACTIVITIES = {value for value, _label in PlayerPosition.ACTIVITY_CHOICES}
# Long enough for the ids the campus generates ("lecture-5-8", "cafe-11.5-13-0.8-1.4")
# and short enough that the column cannot be used as free storage.
_MAX_SEAT_ID = 48

# The 2D frame is the world scaled by ten about (400, 300), and the campus is
# clamped to 150 world units, so nothing legitimate reaches four figures either
# side of the offsets. Generous, because it only has to catch nonsense.
_MAX_COORDINATE = 100000

# How far a thrown object may travel from the person who threw it, in the same
# 2D units. Twenty-five world metres — a long throw, and short enough that a
# modified client cannot post a ball across the campus into a locked room.
_MAX_THROW = 250

# How high off the floor a player may claim to be, in world metres. Unlike the
# ground plane this is not scaled: the tallest thing on the campus is the main
# building at twenty-five metres, so this is generous and still small enough
# that a bad value cannot put somebody in orbit above everybody's scene.
_MAX_ELEVATION = 200

# What one message may be, matching `ChatMessage.message`. Truncated rather
# than rejected: a client that sends slightly too much has still said
# something, and the whiteboard's stroke format is sized against this exact
# number — `whiteboardStrokes.ts` derives its point budget from it.
MAX_CHAT_LENGTH = 500


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


def _clean_floor(value):
    """
    A floor the building actually has, or None.

    Four levels, and nothing else. A car sent to floor nine is one whose doors
    are at a height no player can reach, so nobody could call it back.
    """
    try:
        floor = int(value)
    except (TypeError, ValueError):
        return None
    if floor < LiftCar.GROUND or floor > LiftCar.TOP:
        return None
    return floor

def _clean_directions():
    return {value for value, _label in PlayerPosition._meta.get_field('direction').choices}


_DIRECTIONS = None


def _clean_direction(value):
    """One of the four the column allows, or the default.

    `direction` is a `CharField` with choices, and choices are not enforced on
    save — so anything at all went in, and every client read it back out. The
    avatar's cardinal fallback looks it up in a Map, which is why an unknown
    value there is merely ignored rather than fatal; that is luck, not design.
    """
    global _DIRECTIONS
    if _DIRECTIONS is None:
        _DIRECTIONS = _clean_directions()
    return value if value in _DIRECTIONS else 'down'


def _clean_activity(value):
    """One of the poses we know, or standing. Never whatever the client sent."""
    return value if value in _ACTIVITIES else PlayerPosition.STANDING


def _clean_token(value):
    """
    A bounded id, or None.

    Seats, props and rooms are all client-supplied strings naming something in
    the campus layout. None of them is trusted for anything but equality, and
    all of them need the same guard: a non-empty string that cannot be used as
    free storage.
    """
    if not isinstance(value, str):
        return None
    token = value.strip()
    if not token or len(token) > _MAX_SEAT_ID:
        return None
    return token


def _clean_coordinate(value, limit=_MAX_COORDINATE):
    """
    A finite position in the 2D frame the campus uses, or None.

    Same reasoning as the heading: this is written to a float column and read
    back by every other client, so a NaN or an infinity here is a row that
    breaks everyone's scene rather than just the sender's.
    """
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or abs(number) > limit:
        return None
    return number


def _clean_elevation(value):
    """A finite height above the floor, or zero.

    Same reasoning as `_clean_coordinate`, with the campus's own bound: this is
    metres, not the scaled 2D frame, so it gets its own limit rather than
    borrowing one four orders of magnitude too large.
    """
    height = _clean_coordinate(value, _MAX_ELEVATION)
    return 0.0 if height is None else height


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
        
        # Logging rather than print: this runs per connection and print goes
        # straight to the server's stdout in production, where it cannot be
        # levelled, filtered or turned off.
        logger.debug("connection attempt on lobby %s by %s", self.lobby_id, self.user)

        # Check if user is authenticated
        if not self.user.is_authenticated:
            logger.info("rejecting unauthenticated connection to lobby %s", self.lobby_id)
            await self.close(code=4001)
            return

        # Check if lobby exists and user is a member
        lobby_exists = await self.check_lobby_membership()
        if not lobby_exists:
            await self.close(code=4003)
            return

        # Join lobby group
        await self.channel_layer.group_add(
            self.lobby_group_name,
            self.channel_name
        )

        await self.accept()

        # They are here. `is_online` is what capacity is counted from, and
        # nothing but joining ever set it — see `mark_online`.
        await self.mark_online(True)

        logger.info("%s connected to lobby %s", self.user.username, self.lobby_id)

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

            # And put down whatever they were carrying, where they were
            # standing. An object held by somebody who has closed the tab is
            # one nobody can pick up again: the constraint that makes it theirs
            # does not care that they have gone.
            dropped = await self.drop_everything()
            if dropped:
                prop, x, y, room = dropped
                await self.broadcast_prop(prop, held=False, x=x, y=y, room=room)

            # And they are gone.
            #
            # Per socket, not per person: somebody with the campus open in two
            # tabs who closes one reads as offline until they next connect.
            # That is the wrong answer for them and a much better one than the
            # status quo, where nobody was ever offline at all — the cost is a
            # lobby with one more free slot than it should have, against a
            # lobby that fills with ghosts and then refuses everybody.
            #
            # Doing it properly wants a heartbeat: `last_seen` is already
            # touched on every connect, so "online" could be "seen recently"
            # rather than a flag two events have to agree about.
            await self.mark_online(False)

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
            elif message_type == 'take_prop':
                await self.handle_take_prop(data)
            elif message_type == 'drop_prop':
                await self.handle_drop_prop(data)
            elif message_type == 'call_lift':
                await self.handle_call_lift(data)
            elif message_type == 'set_light':
                await self.handle_set_light(data)
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
        # Every field cleaned, not only the two that were.
        #
        # `_clean_coordinate` and `_clean_token` were written for the props and
        # sat a few lines above this, unused by the hot path. So a frame with a
        # non-numeric `x` reached a FloatField and raised out of a `receive`
        # that catches only `json.JSONDecodeError` — killing the socket — and a
        # `current_room` longer than fifty characters raised on PostgreSQL,
        # which is production, while passing on the SQLite everyone develops
        # against.
        x = _clean_coordinate(data.get('x'))
        y = _clean_coordinate(data.get('y'))
        if x is None or y is None:
            return

        position_data = {
            'x': x,
            'y': y,
            'direction': _clean_direction(data.get('direction')),
            'heading': _clean_heading(data.get('heading')),
            # The third axis, bounded and finite for the same reason the
            # heading is: it is written to a float column and read back by
            # every other client, so a NaN here breaks everyone's scene rather
            # than only the sender's.
            'elevation': _clean_elevation(data.get('elevation')),
            'activity': _clean_activity(data.get('activity')),
            'is_moving': bool(data.get('is_moving', False)),
            'current_room': _clean_token(data.get('current_room')),
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
        seat = _clean_token(data.get('seat'))
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

    async def handle_take_prop(self, data):
        """
        Pick something up, if it is not already in somebody's hands.

        Decided here for the same reason a chair is: a ball that two clients
        each believe they are holding is two balls, and only one of them is
        going to land where the other expects.
        """
        prop = _clean_token(data.get('prop'))
        if not prop:
            await self.send(text_data=json.dumps({'type': 'prop_denied', 'prop': None}))
            return

        taken = await self.claim_prop(prop)
        if not taken:
            await self.send(text_data=json.dumps({'type': 'prop_denied', 'prop': prop}))
            return

        await self.broadcast_prop(prop, held=True)

    async def handle_drop_prop(self, data):
        """
        Put down or throw whatever the player is carrying.

        The landing place comes from the client, which is what simulated the
        arc, but the distance is the server's to bound: without it, "I dropped
        it here" names any point on the campus, and an object is a thing you
        can hide inside a wall or post into a room you are not in.
        """
        prop = _clean_token(data.get('prop'))
        x = _clean_coordinate(data.get('x'))
        y = _clean_coordinate(data.get('y'))
        if not prop or x is None or y is None:
            await self.send(text_data=json.dumps({'type': 'prop_denied', 'prop': prop}))
            return

        landed = await self.release_prop(prop, x, y)
        if not landed:
            # They were not holding it. Nothing to announce: the client that
            # thinks otherwise is corrected by the next lobby snapshot.
            await self.send(text_data=json.dumps({'type': 'prop_denied', 'prop': prop}))
            return

        await self.broadcast_prop(prop, held=False, x=landed[0], y=landed[1], room=landed[2])

    async def handle_call_lift(self, data):
        """
        Send the lift to a floor, for everybody.

        No permission check, for the same reason the light switch has none: a
        lift only the host may call is a worse feature than no lift, and the
        worst anybody can do with it is take it to a floor somebody else did
        not want.

        The floor is bounded here rather than trusted. It indexes a fixed set
        of four levels on the client, and an out-of-range value would be a car
        parked at a storey that does not exist — which nobody could then call
        back, because the doors would never be anywhere reachable.
        """
        floor = _clean_floor(data.get('floor'))
        if floor is None:
            return

        await self.store_lift(floor)
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'lift_update',
                'user_id': self.user.id,
                'floor': floor,
            },
        )

    async def lift_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'lift_update',
            'user_id': event['user_id'],
            'floor': event['floor'],
        }))

    @database_sync_to_async
    def store_lift(self, floor):
        LiftCar.objects.update_or_create(
            lobby_id=self.lobby_id,
            defaults={'floor': floor, 'called_by': self.user},
        )

    async def handle_set_light(self, data):
        """
        Flick a room's lights, for everybody in it.

        No permission check. A light switch that only the host may touch is a
        worse feature than no light switch, and the worst anybody can do with
        it is turn the lights off in a room they are standing in.
        """
        room = _clean_token(data.get('room'))
        if not room:
            return

        on = bool(data.get('on'))
        await self.store_light(room, on)
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'light_update',
                'user_id': self.user.id,
                'room': room,
                'on': on,
            }
        )

    async def broadcast_prop(self, prop, held, x=None, y=None, room=None):
        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'prop_update',
                'user_id': self.user.id,
                'prop': prop,
                'held': held,
                'x': x,
                'y': y,
                'room': room,
            }
        )

    async def prop_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'prop_update',
            'user_id': event['user_id'],
            'prop': event['prop'],
            'held': event['held'],
            'x': event['x'],
            'y': event['y'],
            'room': event['room'],
        }))

    async def light_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'light_update',
            'user_id': event['user_id'],
            'room': event['room'],
            'on': event['on'],
        }))

    @database_sync_to_async
    def claim_prop(self, prop):
        """
        Takes the object, or reports that somebody else has it.

        The unique constraint is the authority, exactly as it is for seats: two
        players reaching for the same ball in one tick both see it lying free.
        """
        try:
            with transaction.atomic():
                position, _ = PlayerPosition.objects.get_or_create(
                    user=self.user, lobby_id=self.lobby_id
                )
                if position.holding and position.holding != prop:
                    # One thing at a time. Otherwise a player accumulates the
                    # whole campus and nothing can ever be picked up again.
                    return False
                if PlayerPosition.objects.filter(
                    lobby_id=self.lobby_id, holding=prop
                ).exclude(pk=position.pk).exists():
                    return False
                position.holding = prop
                position.save(update_fields=['holding', 'last_updated'])
                return True
        except IntegrityError:
            return False

    @database_sync_to_async
    def release_prop(self, prop, x, y):
        """
        Records where the object came to rest, and frees the hands holding it.

        Returns the resting place actually stored, which is not always the one
        asked for: the throw is clamped to `_MAX_THROW` of the thrower. Returns
        None if this player was not holding the thing they say they dropped.
        """
        with transaction.atomic():
            position = PlayerPosition.objects.filter(
                lobby_id=self.lobby_id, user=self.user, holding=prop
            ).first()
            if position is None:
                return None

            # Clamped along the line from the thrower, so an over-long throw
            # becomes a shorter one in the same direction rather than a throw
            # that does not happen.
            dx = x - position.x
            dy = y - position.y
            distance = math.hypot(dx, dy)
            if distance > _MAX_THROW:
                scale = _MAX_THROW / distance
                x = position.x + dx * scale
                y = position.y + dy * scale

            room = position.current_room
            position.holding = None
            position.save(update_fields=['holding', 'last_updated'])
            CampusProp.objects.update_or_create(
                lobby_id=self.lobby_id,
                prop=prop,
                defaults={'x': x, 'y': y, 'room': room},
            )
            return x, y, room

    @database_sync_to_async
    def drop_everything(self):
        """
        Let go of whatever is being carried, wherever the player stands.

        Called on disconnect, alongside releasing the seat. An object held by
        somebody who has closed the tab is one nobody can ever pick up again,
        because the constraint that makes it theirs does not care that they
        have gone.
        """
        position = PlayerPosition.objects.filter(
            lobby_id=self.lobby_id, user=self.user
        ).exclude(holding=None).first()
        if position is None:
            return None

        prop = position.holding
        position.holding = None
        position.save(update_fields=['holding', 'last_updated'])
        CampusProp.objects.update_or_create(
            lobby_id=self.lobby_id,
            prop=prop,
            defaults={'x': position.x, 'y': position.y, 'room': position.current_room},
        )
        return prop, position.x, position.y, position.current_room

    @database_sync_to_async
    def store_light(self, room, on):
        RoomLight.objects.update_or_create(
            lobby_id=self.lobby_id,
            room=room,
            defaults={'on': on, 'changed_by': self.user},
        )

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
        """
        Handle chat messages.

        Two things this did not do. It called `.strip()` on whatever arrived,
        so a client sending a number instead of a string raised `AttributeError`
        and took the socket down with it. And it wrote the result straight to
        the column with no length check: `ChatMessage.message` is a `TextField`
        with `max_length=500`, which Django applies in forms and serializers and
        not in the database, and `objects.create` runs neither.

        A 200,000-character message was accepted, stored, and fanned out to
        every member of the lobby — then handed to everybody who joined
        afterwards, because the last fifty messages ride along in the lobby
        snapshot.
        """
        message = data.get('message')
        if not isinstance(message, str):
            return

        message = message.strip()[:MAX_CHAT_LENGTH]
        if not message:
            return
            
        # Which channel it was said on.
        #
        # The client has always sent this and the consumer has always thrown it
        # away — never stored, never put on the broadcast — so every message
        # came back labelled 'global' whatever tab it was typed in. The chat has
        # a "nearby" tab, so people were saying things they believed were going
        # to whoever was around them and sending them to the entire lobby.
        room = _clean_token(data.get('room'))

        chat_message = await self.save_chat_message(message, room)

        await self.channel_layer.group_send(
            self.lobby_group_name,
            {
                'type': 'chat_message',
                'message_id': chat_message.id,
                'user_id': self.user.id,
                'username': self.user.username,
                'message': message,
                'room': room,
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
            'room': event.get('room'),
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
    def mark_online(self, online):
        """
        Say whether this member is here.

        `is_online` was set to `True` when somebody joined and never set back.
        Nothing anywhere wrote `False` — so closing the tab, losing the
        connection or navigating away left you online for ever, and since
        `Lobby.current_players_count` counts exactly this, a lobby filled up
        with people who were not in it and then refused everybody with "Lobby
        is full".

        Also touches `last_seen`, which is `auto_now` and so had been frozen at
        the moment of joining for the same reason: nothing on the socket path
        ever saved the row.
        """
        LobbyMember.objects.filter(lobby_id=self.lobby_id, user=self.user).update(
            is_online=online, last_seen=timezone.now()
        )

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
            allowed = {
                'x', 'y', 'direction', 'heading', 'elevation', 'activity',
                'is_moving', 'current_room',
            }
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

            # The seat goes on the broadcast payload as well, read from the row
            # and never from the frame — it is not in `allowed`, so a client
            # cannot put one there. Peers keep their own map of who is sitting
            # where, and a frame that carried no seat at all read as "nobody",
            # so a seated player's chair dropped out of it the moment they
            # waved. The chair was then offered to the next person to walk up,
            # who pressed the key and had the claim refused.
            position_data['seat'] = position.seat if position else None
            # And what is in their hands, for the same reason: a frame that
            # says nothing about it reads as empty-handed, so the object would
            # blink out of the carrier's hands every time they moved.
            position_data['holding'] = position.holding if position else None

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
    def save_chat_message(self, message, room=None):
        """Save chat message to the database."""
        try:
            lobby = Lobby.objects.get(id=self.lobby_id)
            chat_message = ChatMessage.objects.create(
                lobby=lobby,
                user=self.user,
                message=message,
                room=room,
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

            # Where the loose objects are lying, and which rooms are dark.
            # Both are things the world remembers between visits, so somebody
            # arriving has to be told them or they see the room as it was
            # built rather than as the last person left it.
            props = list(CampusProp.objects.filter(lobby=lobby))
            lights = list(RoomLight.objects.filter(lobby=lobby))
            # Where the lift is standing. Left out and somebody arriving sees
            # it at the ground floor while everybody else is looking at it on
            # the third.
            lift = LiftCar.objects.filter(lobby=lobby).first()

            return {
                'lobby': lobby,
                'members': members,
                'positions': positions,
                'messages': messages,
                'props': props,
                'lights': lights,
                'lift': lift,
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
                # Left out of this snapshot and everybody who was already
                # sitting on a tier when you arrived is drawn on the floor
                # until they next move.
                'elevation': getattr(position, 'elevation', 0.0),
                'activity': getattr(position, 'activity', PlayerPosition.STANDING),
                'seat': getattr(position, 'seat', None),
                'holding': getattr(position, 'holding', None),
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
                'room': message.room,
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
            'props': [
                {'prop': prop.prop, 'x': prop.x, 'y': prop.y, 'room': prop.room}
                for prop in lobby_state['props']
            ],
            'lights': [
                {'room': light.room, 'on': light.on} for light in lobby_state['lights']
            ],
            # No row means nobody has used it, which is the ground floor.
            'lift': {'floor': lobby_state['lift'].floor if lobby_state['lift'] else 0},
        }))
