from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
import random
import string


def generate_lobby_id():
    """Generate a unique 8-digit lobby ID"""
    return ''.join(random.choices(string.digits, k=8))


class Lobby(models.Model):
    """Main lobby model for campus simulation"""
    id = models.CharField(max_length=8, primary_key=True, default=generate_lobby_id, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hosted_lobbies')
    password = models.CharField(max_length=100, blank=True, null=True)
    max_players = models.IntegerField(
        default=20, 
        validators=[MinValueValidator(2), MaxValueValidator(20)]
    )
    is_active = models.BooleanField(default=True)
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.id})"

    @property
    def current_players_count(self):
        return self.members.filter(is_online=True).count()

    @property
    def is_full(self):
        return self.current_players_count >= self.max_players

    def save(self, *args, **kwargs):
        # Ensure unique lobby ID
        while Lobby.objects.filter(id=self.id).exclude(pk=self.pk).exists():
            self.id = generate_lobby_id()
        super().save(*args, **kwargs)


class LobbyMember(models.Model):
    """Players in a lobby"""
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    is_online = models.BooleanField(default=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['lobby', 'user']
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.user.username} in {self.lobby.name}"


class PlayerPosition(models.Model):
    """Player position and state in the game world"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE)
    x = models.FloatField(default=400.0)  # Starting position X
    y = models.FloatField(default=300.0)  # Starting position Y
    direction = models.CharField(
        max_length=10, 
        choices=[
            ('up', 'Up'),
            ('down', 'Down'),
            ('left', 'Left'),
            ('right', 'Right'),
        ],
        default='down'
    )
    is_moving = models.BooleanField(default=False)
    current_room = models.CharField(max_length=50, blank=True, null=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'lobby']
        ordering = ['last_updated']

    def __str__(self):
        return f"{self.user.username} at ({self.x}, {self.y}) in {self.lobby.name}"


class StudyRoom(models.Model):
    """Study rooms within the campus"""
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE, related_name='study_rooms')
    name = models.CharField(max_length=50)
    x = models.FloatField()  # Room position X
    y = models.FloatField()  # Room position Y
    width = models.FloatField(default=150.0)
    height = models.FloatField(default=100.0)
    max_capacity = models.IntegerField(default=8)
    presenter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='presenting_rooms'
    )
    is_presentation_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['lobby', 'name']
        ordering = ['name']

    def __str__(self):
        return f"{self.name} in {self.lobby.name}"

    @property
    def current_occupants_count(self):
        return PlayerPosition.objects.filter(
            lobby=self.lobby,
            current_room=self.name
        ).count()

    @property
    def is_full(self):
        return self.current_occupants_count >= self.max_capacity


class ChatMessage(models.Model):
    """Chat messages in the game"""
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE, related_name='chat_messages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField(max_length=500)
    room = models.CharField(max_length=50, blank=True, null=True)  # Global chat if None
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}: {self.message[:50]}..."


class SavedLobby(models.Model):
    """User's saved lobbies for quick access"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_lobbies')
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'lobby']
        ordering = ['-saved_at']

    def __str__(self):
        return f"{self.user.username} saved {self.lobby.name}"
