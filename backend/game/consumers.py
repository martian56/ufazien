"""
WebSocket consumers for real-time game communication.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Lobby, LobbyMember, PlayerPosition, ChatMessage

User = get_user_model()


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
        position_data = {
            'x': data.get('x', 0),
            'y': data.get('y', 0),
            'z': data.get('z', 0),
            'rotation_x': data.get('rotation_x', 0),
            'rotation_y': data.get('rotation_y', 0),
            'rotation_z': data.get('rotation_z', 0),
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
            allowed = {'x', 'y', 'direction', 'is_moving', 'current_room'}
            defaults = {k: v for k, v in position_data.items() if k in allowed}
            position, created = PlayerPosition.objects.update_or_create(
                lobby=lobby,
                user=self.user,
                defaults=defaults
            )
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
                # Send only the fields our frontend expects (x, y, direction, is_moving)
                'x': position.x,
                'y': position.y,
                'direction': getattr(position, 'direction', None),
                'is_moving': getattr(position, 'is_moving', False),
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
