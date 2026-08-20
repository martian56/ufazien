from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Lobby, LobbyMember, PlayerPosition, ChatMessage, SavedLobby

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Basic user info for game display.

    Deliberately narrow, and `email` is not in it — see the rule in CLAUDE.md.
    `campus_character` is here because everyone in the room has to draw
    everyone else, and read-only because this is what other people see of you,
    not where you change it.
    """

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'campus_character']
        read_only_fields = fields


class LobbyMemberSerializer(serializers.ModelSerializer):
    """Lobby member with user info"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = LobbyMember
        fields = ['user', 'joined_at', 'is_online', 'last_seen']


class LobbySerializer(serializers.ModelSerializer):
    """Main lobby serializer"""
    host = UserSerializer(read_only=True)
    members = LobbyMemberSerializer(many=True, read_only=True)
    current_players_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    
    class Meta:
        model = Lobby
        fields = [
            'id', 'name', 'description', 'host', 'is_private', 
            'max_players', 'is_active', 'created_at', 'updated_at',
            'current_players_count', 'is_full', 'members'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LobbyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new lobbies"""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = Lobby
        fields = ['name', 'description', 'is_private', 'password', 'max_players']
    
    def create(self, validated_data):
        validated_data['host'] = self.context['request'].user
        return super().create(validated_data)


class LobbyListSerializer(serializers.ModelSerializer):
    """Simplified serializer for lobby listing"""
    host = UserSerializer(read_only=True)
    current_players_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    
    class Meta:
        model = Lobby
        fields = [
            'id', 'name', 'description', 'host', 'is_private',
            'max_players', 'current_players_count', 'is_full', 'created_at'
        ]


class PlayerPositionSerializer(serializers.ModelSerializer):
    """Player position and state"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = PlayerPosition
        fields = [
            'user', 'x', 'y', 'direction', 'is_moving', 
            'current_room', 'last_updated'
        ]


class ChatMessageSerializer(serializers.ModelSerializer):
    """Chat message with user info"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'user', 'message', 'room', 'created_at']
        read_only_fields = ['id', 'created_at']


class SavedLobbySerializer(serializers.ModelSerializer):
    """User's saved lobbies"""
    lobby = LobbyListSerializer(read_only=True)
    
    class Meta:
        model = SavedLobby
        fields = ['lobby', 'saved_at']


class JoinLobbySerializer(serializers.Serializer):
    """Serializer for joining a lobby"""
    lobby_id = serializers.CharField(max_length=8)
    password = serializers.CharField(required=False, allow_blank=True)
    
    def validate_lobby_id(self, value):
        try:
            lobby = Lobby.objects.get(id=value, is_active=True)
        except Lobby.DoesNotExist:
            raise serializers.ValidationError("Lobby not found or inactive")
        
        if lobby.is_full:
            raise serializers.ValidationError("Lobby is full")
        
        return value


class QuickJoinSerializer(serializers.Serializer):
    """Serializer for quick join functionality"""
    preferred_lobby_type = serializers.ChoiceField(
        choices=['public', 'private', 'any'],
        default='public'
    )
    max_players_preference = serializers.IntegerField(
        min_value=2, max_value=20, required=False
    )