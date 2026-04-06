from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Group chat WebSocket
    re_path(r'ws/community/groups/(?P<group_id>[0-9a-f-]+)/chat/$', consumers.GroupChatConsumer.as_asgi()),
    
    # Private chat WebSocket
    re_path(r'ws/community/chats/(?P<chat_id>[0-9a-f-]+)/$', consumers.PrivateChatConsumer.as_asgi()),
    
    # Community notifications WebSocket
    re_path(r'ws/community/notifications/$', consumers.CommunityNotificationConsumer.as_asgi()),
]
