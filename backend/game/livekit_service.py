"""LiveKit access tokens and participant control for campus lobbies.

One LiveKit room per lobby, named ``lobby-<lobby_id>``. Everyone in the lobby
shares a room so voice can be attenuated by distance client-side; study rooms
are a screen-share permission rather than a separate room, which keeps
proximity voice working everywhere on the map.
"""

import logging
import os
from datetime import timedelta

logger = logging.getLogger(__name__)


class LiveKitNotConfigured(RuntimeError):
    """Raised when the LiveKit credentials are absent."""


def _credentials():
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    url = os.getenv("LIVEKIT_URL")
    if not (api_key and api_secret and url):
        raise LiveKitNotConfigured(
            "LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL must be set."
        )
    return api_key, api_secret, url


def room_name(lobby_id):
    return f"lobby-{lobby_id}"


def participant_identity(user):
    """Stable identity so the server can target a participant later."""
    return f"user-{user.id}"


def allowed_sources(member, is_host):
    """Which track sources this member may publish.

    Microphone is withheld while muted, and screen share requires either being
    the host or having been granted it. Enforcing this in the token means a
    modified client cannot publish anyway.
    """
    sources = []
    if not member.is_muted:
        sources.append("microphone")
    if is_host or member.can_share_screen:
        sources.extend(["screen_share", "screen_share_audio"])
    return sources


def build_token(user, lobby, member):
    """Mint a join token for one participant of one lobby."""
    from livekit.api import AccessToken, VideoGrants

    api_key, api_secret, url = _credentials()
    is_host = lobby.host_id == user.id
    sources = allowed_sources(member, is_host)

    grants = VideoGrants(
        room_join=True,
        room=room_name(lobby.id),
        can_subscribe=True,
        can_publish=bool(sources),
        can_publish_data=True,
        can_publish_sources=sources,
    )

    token = (
        AccessToken(api_key, api_secret)
        .with_identity(participant_identity(user))
        .with_name(user.get_full_name() or user.username)
        .with_ttl(timedelta(hours=6))
        .with_grants(grants)
    )
    return {
        "token": token.to_jwt(),
        "url": url,
        "room": room_name(lobby.id),
        "identity": participant_identity(user),
        "can_publish_sources": sources,
        "is_host": is_host,
    }


async def _apply_permissions(lobby, user, member, is_host):
    from livekit import api

    api_key, api_secret, url = _credentials()
    client = api.LiveKitAPI(url=url, api_key=api_key, api_secret=api_secret)
    try:
        sources = allowed_sources(member, is_host)
        await client.room.update_participant(
            api.UpdateParticipantRequest(
                room=room_name(lobby.id),
                identity=participant_identity(user),
                permission=api.ParticipantPermission(
                    can_subscribe=True,
                    can_publish=bool(sources),
                    can_publish_data=True,
                    can_publish_sources=sources,
                ),
            )
        )
    finally:
        await client.aclose()


async def _remove(lobby, user):
    from livekit import api

    api_key, api_secret, url = _credentials()
    client = api.LiveKitAPI(url=url, api_key=api_key, api_secret=api_secret)
    try:
        await client.room.remove_participant(
            api.RoomParticipantIdentity(
                room=room_name(lobby.id),
                identity=participant_identity(user),
            )
        )
    finally:
        await client.aclose()


def remove_participant(lobby, user):
    """
    Disconnect somebody from the lobby's room.

    Removing a member from the database is not enough on its own: LiveKit is a
    separate service that knows nothing about it, so somebody turned out of a
    lobby stayed on the call — still heard, still heard from, still watching a
    screen share — until they closed the tab themselves.

    Best effort, like the permission push beside it. A member who was not on
    the call has nothing to disconnect, and that is not an error; nor is a
    machine with no voice configured, which is the normal case in development.
    """
    import asyncio

    try:
        asyncio.run(_remove(lobby, user))
        return True
    except LiveKitNotConfigured:
        return False
    except Exception as exc:
        logger.info(
            "Could not disconnect %s from lobby %s: %s",
            participant_identity(user), lobby.id, exc,
        )
        return False


def sync_participant_permissions(lobby, user, member):
    """Push a permission change to a participant who is already connected.

    Best effort: a member who is not currently in the room has nothing to
    update, and that is not an error. The stored flags remain the source of
    truth for their next token.
    """
    import asyncio

    is_host = lobby.host_id == user.id
    try:
        asyncio.run(_apply_permissions(lobby, user, member, is_host))
        return True
    except LiveKitNotConfigured:
        raise
    except Exception as exc:
        logger.info(
            "Could not update LiveKit permissions for %s in lobby %s: %s",
            participant_identity(user), lobby.id, exc,
        )
        return False
