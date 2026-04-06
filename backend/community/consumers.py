import json
import uuid
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from .models import Group, GroupMessage, PrivateChat, PrivateMessage, GroupMembership

User = get_user_model()


class GroupChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for group chat functionality"""
    
    async def connect(self):
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.group_room_name = f'group_chat_{self.group_id}'
        self.user = self.scope.get('user')
        
        # Check if user is authenticated
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return
        
        # Verify user is member of this group
        if not await self.is_group_member():
            await self.close(code=4003)
            return
        
        # Join group chat
        await self.channel_layer.group_add(
            self.group_room_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send user joined notification to group
        await self.channel_layer.group_send(
            self.group_room_name,
            {
                'type': 'user_joined',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'group_room_name'):
            # Send user left notification to group
            await self.channel_layer.group_send(
                self.group_room_name,
                {
                    'type': 'user_left',
                    'user_id': str(self.user.id),
                    'username': self.user.username,
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            # Leave group chat
            await self.channel_layer.group_discard(
                self.group_room_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')
            
            if message_type == 'message':
                await self.handle_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
            elif message_type == 'stop_typing':
                await self.handle_stop_typing(text_data_json)
            
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': f'Error processing message: {str(e)}'
            }))
    
    async def handle_message(self, data):
        content = data.get('content', '').strip()
        if not content:
            return
        
        # Save message to database
        message = await self.save_group_message(content)
        if not message:
            return
        
        # Send message to group
        await self.channel_layer.group_send(
            self.group_room_name,
            {
                'type': 'group_message',
                'message': {
                    'id': str(message.id),
                    'content': message.content,
                    'sender': {
                        'id': str(message.sender.id),
                        'username': message.sender.username,
                        'first_name': message.sender.first_name,
                        'last_name': message.sender.last_name,
                    },
                    'timestamp': message.created_at.isoformat(),
                    'message_type': message.message_type
                }
            }
        )
    
    async def handle_typing(self, data):
        await self.channel_layer.group_send(
            self.group_room_name,
            {
                'type': 'user_typing',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    async def handle_stop_typing(self, data):
        await self.channel_layer.group_send(
            self.group_room_name,
            {
                'type': 'user_stop_typing',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    # WebSocket event handlers
    async def group_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))
    
    async def user_joined(self, event):
        """Send user joined notification"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'user_joined',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def user_left(self, event):
        """Send user left notification"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'user_left',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def user_typing(self, event):
        """Send typing indicator"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def user_stop_typing(self, event):
        """Send stop typing indicator"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'stop_typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    # Database operations
    @database_sync_to_async
    def is_group_member(self):
        """Check if user is a member of the group"""
        try:
            group = Group.objects.get(id=self.group_id)
            return GroupMembership.objects.filter(
                user=self.user, 
                group=group
            ).exists()
        except (ObjectDoesNotExist, ValueError):
            return False
    
    @database_sync_to_async
    def save_group_message(self, content):
        """Save message to database"""
        try:
            group = Group.objects.get(id=self.group_id)
            message = GroupMessage.objects.create(
                group=group,
                sender=self.user,
                content=content,
                message_type='text'
            )
            return message
        except (ObjectDoesNotExist, ValueError):
            return None


class PrivateChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for private chat functionality"""
    
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_room_name = f'private_chat_{self.chat_id}'
        self.user = self.scope.get('user')
        
        # Check if user is authenticated
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return
        
        # Verify user is participant in this chat
        if not await self.is_chat_participant():
            await self.close(code=4003)
            return
        
        # Join private chat
        await self.channel_layer.group_add(
            self.chat_room_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Mark messages as read
        await self.mark_messages_as_read()
        
        # Send user online notification to chat
        await self.channel_layer.group_send(
            self.chat_room_name,
            {
                'type': 'user_online',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'chat_room_name'):
            # Send user offline notification to chat
            await self.channel_layer.group_send(
                self.chat_room_name,
                {
                    'type': 'user_offline',
                    'user_id': str(self.user.id),
                    'username': self.user.username,
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            # Leave private chat
            await self.channel_layer.group_discard(
                self.chat_room_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')
            
            if message_type == 'message':
                await self.handle_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
            elif message_type == 'stop_typing':
                await self.handle_stop_typing(text_data_json)
            elif message_type == 'mark_read':
                await self.mark_messages_as_read()
            
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': f'Error processing message: {str(e)}'
            }))
    
    async def handle_message(self, data):
        content = data.get('content', '').strip()
        if not content:
            return
        
        # Save message to database
        message = await self.save_private_message(content)
        if not message:
            return
        
        # Send message to chat participants
        await self.channel_layer.group_send(
            self.chat_room_name,
            {
                'type': 'private_message',
                'message': {
                    'id': str(message.id),
                    'content': message.content,
                    'sender': {
                        'id': str(message.sender.id),
                        'username': message.sender.username,
                        'first_name': message.sender.first_name,
                        'last_name': message.sender.last_name,
                    },
                    'timestamp': message.created_at.isoformat(),
                    'message_type': message.message_type,
                    'is_read': message.is_read
                }
            }
        )
    
    async def handle_typing(self, data):
        await self.channel_layer.group_send(
            self.chat_room_name,
            {
                'type': 'user_typing',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    async def handle_stop_typing(self, data):
        await self.channel_layer.group_send(
            self.chat_room_name,
            {
                'type': 'user_stop_typing',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    # WebSocket event handlers
    async def private_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))
    
    async def user_online(self, event):
        """Send user online notification"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'user_online',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def user_offline(self, event):
        """Send user offline notification"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'user_offline',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def user_typing(self, event):
        """Send typing indicator"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def user_stop_typing(self, event):
        """Send stop typing indicator"""
        if event['user_id'] != str(self.user.id):  # Don't send to self
            await self.send(text_data=json.dumps({
                'type': 'stop_typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    # Database operations
    @database_sync_to_async
    def is_chat_participant(self):
        """Check if user is a participant in the chat"""
        try:
            chat = PrivateChat.objects.get(id=self.chat_id)
            return chat.participants.filter(id=self.user.id).exists()
        except (ObjectDoesNotExist, ValueError):
            return False
    
    @database_sync_to_async
    def save_private_message(self, content):
        """Save message to database"""
        try:
            chat = PrivateChat.objects.get(id=self.chat_id)
            message = PrivateMessage.objects.create(
                chat=chat,
                sender=self.user,
                content=content,
                message_type='text'
            )
            return message
        except (ObjectDoesNotExist, ValueError):
            return None
    
    @database_sync_to_async
    def mark_messages_as_read(self):
        """Mark all unread messages in this chat as read for current user"""
        try:
            chat = PrivateChat.objects.get(id=self.chat_id)
            PrivateMessage.objects.filter(
                chat=chat,
                is_read=False
            ).exclude(sender=self.user).update(
                is_read=True,
                read_at=datetime.now()
            )
        except (ObjectDoesNotExist, ValueError):
            pass


class CommunityNotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for community-wide notifications"""
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        # Check if user is authenticated
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)
            return
        
        self.notification_group_name = f'notifications_{self.user.id}'
        
        # Join personal notification group
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group_name'):
            # Leave notification group
            await self.channel_layer.group_discard(
                self.notification_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        # This consumer only sends notifications, doesn't receive messages
        pass
    
    # Notification event handlers
    async def new_group_message(self, event):
        """Send new group message notification"""
        await self.send(text_data=json.dumps({
            'type': 'new_group_message',
            'group_id': event['group_id'],
            'group_name': event['group_name'],
            'sender': event['sender'],
            'message_preview': event['message_preview'],
            'timestamp': event['timestamp']
        }))
    
    async def new_forum_post(self, event):
        """Send new forum post notification"""
        await self.send(text_data=json.dumps({
            'type': 'new_forum_post',
            'post_id': event['post_id'],
            'post_title': event['post_title'],
            'forum_name': event['forum_name'],
            'author': event['author'],
            'timestamp': event['timestamp']
        }))
    
    async def new_post_reply(self, event):
        """Send new post reply notification"""
        await self.send(text_data=json.dumps({
            'type': 'new_post_reply',
            'post_id': event['post_id'],
            'post_title': event['post_title'],
            'reply_author': event['reply_author'],
            'timestamp': event['timestamp']
        }))
    
    async def group_invitation(self, event):
        """Send group invitation notification"""
        await self.send(text_data=json.dumps({
            'type': 'group_invitation',
            'group_id': event['group_id'],
            'group_name': event['group_name'],
            'inviter': event['inviter'],
            'timestamp': event['timestamp']
        }))
