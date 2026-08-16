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

    # Realtime A/V permissions. These live here, not on the client, because the
    # LiveKit token is minted from them: a participant cannot grant itself the
    # right to publish.
    can_share_screen = models.BooleanField(default=False)
    is_muted = models.BooleanField(default=False)

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
    # Where the player is actually looking, in radians.
    #
    # `direction` above is four cardinal values, which is all the old sprite
    # campus needed. In 3D it means someone walking diagonally across the quad
    # is drawn facing north — you never notice on yourself, because you are in
    # first person, and everybody else looks wrong. Kept alongside rather than
    # replacing it, so a client that sends no heading still renders.
    heading = models.FloatField(default=0.0)

    STANDING = 'standing'
    SITTING = 'sitting'
    LEANING = 'leaning'
    WAVING = 'waving'
    CLAPPING = 'clapping'
    HAND_RAISED = 'hand_raised'
    POINTING = 'pointing'
    ACTIVITY_CHOICES = [
        (STANDING, 'Standing'),
        (SITTING, 'Sitting'),
        (LEANING, 'Leaning'),
        (WAVING, 'Waving'),
        (CLAPPING, 'Clapping'),
        (HAND_RAISED, 'Hand raised'),
        (POINTING, 'Pointing'),
    ]
    # What the player is doing, as opposed to where they are. Without it,
    # nothing anyone does is visible to anyone else: sitting down is a purely
    # local illusion and everyone else still sees you standing in the aisle.
    activity = models.CharField(
        max_length=16, choices=ACTIVITY_CHOICES, default=STANDING
    )

    # Which seat, when sitting. Held here rather than on the client because it
    # is what stops two people occupying the same chair, and a check that lives
    # in the browser is one a modified browser simply does not perform.
    seat = models.CharField(max_length=48, blank=True, null=True)

    # What the player is carrying, if anything. Held here for the same reason
    # the seat is: a ball two people are both holding is two balls, and the
    # only place that can be decided once is the server.
    holding = models.CharField(max_length=48, blank=True, null=True)

    # How high the floor is under the player's feet, in world metres.
    #
    # Not part of the 2D frame `x` and `y` use: those are the ground plane,
    # scaled and offset, and this is the third axis in plain metres above
    # whatever floor the player is standing on. Kept separate rather than
    # folded into that frame so nobody applies the offset to it.
    #
    # Without it every remote player is drawn at zero, which is wrong anywhere
    # the floor is not: forty-five of the amphitheatre's fifty-four seats are
    # raised, all sixteen of the sports hall's are, and the main stair climbs
    # four and a half metres. An audience sitting through a lecture appeared to
    # everybody else buried up to the chest in the tiers, and anyone on the
    # stairs walked through the floor.
    elevation = models.FloatField(default=0.0)

    is_moving = models.BooleanField(default=False)
    current_room = models.CharField(max_length=50, blank=True, null=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'lobby']
        ordering = ['last_updated']
        constraints = [
            # One person per chair. Partial, so that the many players sitting
            # in no seat at all do not all collide with each other on NULL.
            models.UniqueConstraint(
                fields=['lobby', 'seat'],
                condition=models.Q(seat__isnull=False),
                name='one_occupant_per_seat',
            ),
            # Empty string is not "no seat". The uniqueness rule above excludes
            # only NULL, so two players holding '' would be a genuine conflict
            # in one lobby — and `default=None` does not prevent a write of ''.
            models.CheckConstraint(
                condition=models.Q(seat__isnull=True) | ~models.Q(seat=''),
                name='seat_is_null_or_named',
            ),
            # And one pair of hands per object, for the same reason.
            models.UniqueConstraint(
                fields=['lobby', 'holding'],
                condition=models.Q(holding__isnull=False),
                name='one_holder_per_prop',
            ),
            models.CheckConstraint(
                condition=models.Q(holding__isnull=True) | ~models.Q(holding=''),
                name='holding_is_null_or_named',
            ),
        ]

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
    # `CharField`, not `TextField`. `max_length` on a TextField is a form-level
    # hint that the database does not enforce and `objects.create` does not
    # check, which is how a 200,000-character message came to be stored and
    # broadcast to a whole lobby. The consumer truncates as well; this is the
    # column refusing to hold more than it says it will.
    message = models.CharField(max_length=500)
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


class RoomLight(models.Model):
    """
    Whether a room's lights are on, for everybody in it.

    A switch that only dimmed the room for whoever flicked it would be a
    decoration. Stored rather than broadcast and forgotten so that somebody
    walking in ten minutes later finds the room as the last person left it,
    which is the whole point of a light switch.

    A row exists only once somebody has touched the switch; the absence of one
    means the room is lit, which is how every room starts.
    """
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE, related_name='room_lights')
    # The building id, as `PlayerPosition.current_room` carries it.
    room = models.CharField(max_length=50)
    on = models.BooleanField(default=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    changed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['lobby', 'room']
        ordering = ['room']

    def __str__(self):
        return f"{self.lobby.name} room {self.room}: {'on' if self.on else 'off'}"


class CampusProp(models.Model):
    """
    Where a thrown or dropped object came to rest.

    Without this a prop is only as real as the broadcast that moved it: two
    people who watched the same throw agree on where the ball landed, and
    anybody who joins afterwards finds it back on its shelf. Recording the
    resting place is what makes the object part of the room rather than part of
    a message.

    Ownership is not here — that is `PlayerPosition.holding`, so that one
    constraint decides who has it. This is only the position it is at when
    nobody does.
    """
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE, related_name='props')
    # The id from the campus layout, e.g. 'ball-court'.
    prop = models.CharField(max_length=48)
    # Which room it is in, as `PlayerPosition.current_room` carries it. Null is
    # the open campus, and a prop cannot be thrown from one room into another.
    room = models.CharField(max_length=50, blank=True, null=True)
    # In the same 2D frame the player positions use, so one conversion serves
    # both and a prop cannot land somewhere a player could not stand.
    x = models.FloatField()
    y = models.FloatField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['lobby', 'prop']
        ordering = ['prop']

    def __str__(self):
        return f"{self.prop} at ({self.x}, {self.y}) in {self.lobby.name}"


class LiftCar(models.Model):
    """
    Where the lift is parked, for everybody in the lobby.

    Stored rather than broadcast and forgotten, for the same reason
    `RoomLight` is: a car that is only on the third floor for the person who
    sent it there is a decoration. Somebody who walks up to the doors has to
    see it where the last person left it, and pressing the call button has to
    actually fetch it.

    A row exists only once somebody has used the lift; the absence of one means
    it is standing at the ground floor, which is where it starts.

    There is no `moving` flag and no destination. The car is at a floor or it is
    travelling to one, and travelling is short enough that the client can play
    it out from the change — sending "it is at 3 now" and letting each client
    run the doors and the ride is a great deal less to keep in step than a
    position ticking over the wire ten times a second.
    """

    # Four floors, matching `FLOOR_PLANS` in the client's vertical circulation.
    GROUND = 0
    TOP = 3

    lobby = models.OneToOneField(Lobby, on_delete=models.CASCADE, related_name='lift')
    floor = models.IntegerField(
        default=GROUND,
        validators=[MinValueValidator(GROUND), MaxValueValidator(TOP)],
    )
    called_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    changed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.lobby.name} lift at floor {self.floor}"
