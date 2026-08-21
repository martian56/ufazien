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
        # `is_online` is a model property rather than a column; DRF reads it
        # through the same name it always had, so the response is unchanged.
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

    def validate(self, attrs):
        """
        A private lobby has to have a password.

        `join_lobby` reads `if lobby.is_private and lobby.password and ...`, so a
        private lobby with a blank password skips the check altogether and lets
        anybody in — while the listing shows it locked and offers "Join
        (Password Required)". The host believes the room is shut and it is open.

        Both halves are enforced here rather than in the browser, because the
        browser is not what decides this: the create form has always allowed
        ticking Private and leaving the box empty.
        """
        private = attrs.get('is_private', getattr(self.instance, 'is_private', False))
        if not private:
            # Going public drops the password rather than keeping it in the row.
            # Kept, it silently comes back the next time privacy is switched on,
            # and the host has no idea which password the lobby now has.
            attrs['password'] = None
            return attrs

        password = attrs.get('password', None)
        if password is None and self.instance is not None:
            # Editing, and the field was left blank: keep whatever is stored.
            password = self.instance.password

        if not (password or '').strip():
            raise serializers.ValidationError(
                {'password': 'A private lobby needs a password, or nobody is kept out by it.'}
            )

        attrs['password'] = password
        return attrs
    
    def create(self, validated_data):
        validated_data['host'] = self.context['request'].user
        return super().create(validated_data)


class LobbyListSerializer(serializers.ModelSerializer):
    """Simplified serializer for lobby listing"""
    host = UserSerializer(read_only=True)
    current_players_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_host = serializers.SerializerMethodField()
    
    class Meta:
        model = Lobby
        fields = [
            'id', 'name', 'description', 'host', 'is_private',
            'max_players', 'current_players_count', 'is_full', 'is_host', 'created_at'
        ]

    def get_is_host(self, obj):
        """
        Whether the person asking hosts this lobby.

        Said here so the client does not have to work it out by comparing the
        host against a profile it fetched separately. It did, and that request
        is deliberately quiet about failing — so one failed profile call took
        the Edit and Close buttons off the only page a host can reach their own
        lobby from, with nothing on screen to say why.

        `False` with no request in context, which is the same shape the email
        rule in `CLAUDE.md` uses: absent context must never read as permission.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and obj.host_id == user.id)


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