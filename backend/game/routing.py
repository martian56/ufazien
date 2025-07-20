"""
WebSocket URL routing for the game app.
"""

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/game/lobby/(?P<lobby_id>\w+)/$', consumers.LobbyConsumer.as_asgi()),
]
