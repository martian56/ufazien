from django.urls import path
from . import views

app_name = 'game'

urlpatterns = [
    # Lobby management
    path('lobbies/', views.lobby_list_create, name='lobby_list_create'),
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
    
    # Statistics
    path('lobbies/stats/', views.lobby_stats, name='lobby_stats'),
]