from django.urls import path
from . import views

app_name = 'game'

urlpatterns = [
    # Lobby management.
    # stats/ must precede <lobby_id>/ or it is captured as a lobby id and 404s.
    path('lobbies/', views.lobby_list_create, name='lobby_list_create'),
    path('lobbies/stats/', views.lobby_stats, name='lobby_stats'),
    path('lobbies/<str:lobby_id>/', views.lobby_detail, name='lobby_detail'),
    path('lobbies/<str:lobby_id>/leave/', views.leave_lobby, name='leave_lobby'),
    
    # Joining lobbies
    path('join/', views.join_lobby, name='join_lobby'),
    path('quick-join/', views.quick_join, name='quick_join'),
    
    # User's lobbies
    path('my-lobbies/', views.my_lobbies, name='my_lobbies'),
    
    # Saved lobbies
    path('saved-lobbies/', views.saved_lobbies, name='saved_lobbies'),
    path('saved-lobbies/<str:lobby_id>/', views.remove_saved_lobby, name='remove_saved_lobby'),

    # Realtime audio / screen share
    path('lobbies/<str:lobby_id>/livekit-token/', views.livekit_token, name='livekit_token'),
    path('lobbies/<str:lobby_id>/permissions/', views.lobby_permissions, name='lobby_permissions'),
    path('lobbies/<str:lobby_id>/members/<int:user_id>/mute/', views.set_member_muted, name='set_member_muted'),
    path('lobbies/<str:lobby_id>/members/<int:user_id>/screen-share/', views.set_member_screen_share, name='set_member_screen_share'),
]