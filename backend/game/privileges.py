"""
Who is allowed to do what in a lobby.

The host used to be whoever happened to be standing in the room: leaving handed
the lobby to the next member, so the person who made it lost it by stepping
out. The host keeps it now — but a lobby whose host has gone home cannot be
left with nobody able to moderate it, so the host can hand out the individual
powers instead of the whole role.

Every one of these is decided here and stored on `LobbyMember`, never asked of
the client. `CLAUDE.md` is explicit about it for the LiveKit grants, and the
same reasoning covers kicking and settings: a modified client must not be able
to grant itself anything.
"""

#: Change the lobby's name, description, privacy, size — and close it.
MANAGE = 'manage'
#: Remove somebody from the lobby.
KICK = 'kick'
#: Mute and unmute other people.
MUTE = 'mute'
#: Publish a screen share.
PRESENT = 'present'

#: The field on `LobbyMember` each one is stored in.
PRIVILEGE_FIELDS = {
    MANAGE: 'can_manage',
    KICK: 'can_kick',
    MUTE: 'can_mute_others',
    PRESENT: 'can_share_screen',
}

#: In the order they are offered, with what to call them.
PRIVILEGES = (
    (MANAGE, 'Change the lobby settings'),
    (KICK, 'Remove people from the lobby'),
    (MUTE, 'Mute and unmute people'),
    (PRESENT, 'Share their screen'),
)


def is_host(lobby, user) -> bool:
    return bool(user and user.is_authenticated and lobby.host_id == user.id)


def member_may(lobby, member, privilege) -> bool:
    """
    Whether this member may do this.

    The host may do everything, without any of it being written down: the row
    says what has been *granted*, and granting the host their own lobby would
    be a thing that could get out of step with who the host is.
    """
    if member is None:
        return False
    if lobby.host_id == member.user_id:
        return True
    field = PRIVILEGE_FIELDS.get(privilege)
    return bool(field and getattr(member, field, False))


def granted_to(lobby, member) -> dict:
    """What this member may do, as a flat map for the client to render."""
    return {name: member_may(lobby, member, name) for name, _label in PRIVILEGES}
