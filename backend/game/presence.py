"""
Who is actually in a lobby.

`is_online` used to be a stored flag that two events had to agree about:
`True` on connect, `False` on disconnect, with nothing distinguishing your
other connection from your only one. Two tabs and the last write won, so
closing one marked you offline while you were still walking around in the
other, and the lobby you were standing in advertised nobody in it (#165). Any
reconnect where the new socket opened before the old one's disconnect was
processed — a network blip, a laptop waking, a proxy dropping an idle
connection — landed the same way round.

It is now two facts, and a member is online when both hold:

* `connections` — how many sockets this member has open. Kept with `F()`
  arithmetic so two tabs increment it to two and closing one leaves one, and
  so concurrent connects cannot lose each other's write.
* `last_seen` — when we last heard from any of them. A count on its own gets
  stuck above zero whenever a worker dies without running `disconnect`, which
  is the old stuck-`True` bug wearing a different hat; staleness heals that
  without anybody having to notice.

Neither fact alone is enough, which is the point: the count makes leaving
immediate, and the clock makes every way of leaving that never says so heal on
its own.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

#: How long a member who has just joined over REST is held a place for while
#: their socket connects. Joining and connecting are two requests, and between
#: them there is nobody on the wire to count — without this, people racing for
#: the last places in a lobby would all be admitted, because at the moment each
#: one was checked none of the others had connected yet.
#:
#: It applies only to a member who has *never* connected, which is what
#: `last_seen IS NULL` means. Somebody who connected and left is gone
#: immediately, however recently they joined: a ghost holding a slot is the bug
#: this file exists to stop.
JOIN_GRACE = timedelta(seconds=60)

#: How long after we last heard from a socket the member is still counted as
#: here. The client sends a heartbeat well inside this (see
#: `HEARTBEAT_SECONDS`), so reaching it means several were missed rather than
#: one being late — a player standing perfectly still sends no position frames
#: at all, and must not blink out for it.
ONLINE_TTL = timedelta(seconds=90)

#: How often the client says it is still there, in seconds. Comfortably inside
#: `ONLINE_TTL`: three of these can go missing before anybody is dropped.
HEARTBEAT_SECONDS = 25

#: How often a socket is allowed to write `last_seen`. Position frames arrive
#: ten times a second while somebody walks, and freshness to the second is
#: worth nothing here — the TTL is ninety.
TOUCH_EVERY_SECONDS = 20


def online_cutoff(now=None):
    """The moment before which a member has not been heard from recently."""
    return (now or timezone.now()) - ONLINE_TTL


def joining_cutoff(now=None):
    """The moment before which a member has had long enough to connect."""
    return (now or timezone.now()) - JOIN_GRACE


def online_q(prefix='', now=None):
    """
    The `Q` for "this member is online", for use from any related name.

    `prefix` is the lookup path to the member, so a `Lobby` queryset passes
    `'members__'` and `LobbyMember.objects` passes nothing.

    Read as: they have a socket open and we have heard from it recently — or
    they have only just joined and have not yet had time to open one at all.
    """
    now = now or timezone.now()
    here = Q(**{
        f'{prefix}connections__gt': 0,
        f'{prefix}last_seen__gte': online_cutoff(now),
    })
    still_arriving = Q(**{
        f'{prefix}last_seen__isnull': True,
        f'{prefix}joined_at__gte': joining_cutoff(now),
    })
    return here | still_arriving
