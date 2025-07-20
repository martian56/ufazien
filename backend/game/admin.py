from django.contrib import admin
from .models import Lobby, LobbyMember, PlayerPosition, StudyRoom, ChatMessage, SavedLobby


@admin.register(Lobby)
class LobbyAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'host', 'is_private', 'current_players_count', 'max_players', 'is_active', 'created_at']
    list_filter = ['is_private', 'is_active', 'created_at']
    search_fields = ['name', 'description', 'host__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    def current_players_count(self, obj):
        return obj.current_players_count
    current_players_count.short_description = 'Current Players'


@admin.register(LobbyMember)
class LobbyMemberAdmin(admin.ModelAdmin):
    list_display = ['user', 'lobby', 'is_online', 'joined_at', 'last_seen']
    list_filter = ['is_online', 'joined_at']
    search_fields = ['user__username', 'lobby__name']


@admin.register(PlayerPosition)
class PlayerPositionAdmin(admin.ModelAdmin):
    list_display = ['user', 'lobby', 'x', 'y', 'direction', 'current_room', 'last_updated']
    list_filter = ['direction', 'is_moving', 'last_updated']
    search_fields = ['user__username', 'lobby__name', 'current_room']


@admin.register(StudyRoom)
class StudyRoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'lobby', 'presenter', 'is_presentation_active', 'current_occupants_count', 'max_capacity']
    list_filter = ['is_presentation_active', 'created_at']
    search_fields = ['name', 'lobby__name']
    
    def current_occupants_count(self, obj):
        return obj.current_occupants_count
    current_occupants_count.short_description = 'Current Occupants'


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['user', 'lobby', 'room', 'message_preview', 'created_at']
    list_filter = ['created_at', 'room']
    search_fields = ['user__username', 'lobby__name', 'message']
    readonly_fields = ['created_at']
    
    def message_preview(self, obj):
        return obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
    message_preview.short_description = 'Message'


@admin.register(SavedLobby)
class SavedLobbyAdmin(admin.ModelAdmin):
    list_display = ['user', 'lobby', 'saved_at']
    list_filter = ['saved_at']
    search_fields = ['user__username', 'lobby__name']
