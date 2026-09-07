"""
Which subdomains a person may take, and what to call them.

`Domain.name` decides two things beyond the address: it is the directory a site
is deployed into (`instance.domain.name.split('.')[0]`), and it is what nginx
roots at. So the name a user types reaches the filesystem and the router, and
both of those care.
"""

import re

from django.conf import settings

#: Names the platform needs, or would be believed if a stranger held them.
#:
#: `api` and `www` are routed to the applications today, but only because
#: Traefik scores a longer rule higher — a routing coincidence, not an access
#: control, and the compose file warns against changing it. The rest are here
#: because a site on `login.ufazien.com`, served under the platform's own
#: wildcard certificate, is a convincing place to ask somebody for a password.
RESERVED_SUBDOMAINS = frozenset({
    'about', 'account', 'accounts', 'admin', 'administrator', 'api', 'assets',
    'auth', 'billing', 'blog', 'cdn', 'community', 'dashboard', 'db', 'dev',
    'docs', 'files', 'ftp', 'game', 'help', 'host', 'hosting', 'imap', 'internal',
    'login', 'logout', 'logs', 'mail', 'media', 'mx', 'mysql', 'ns', 'ns1', 'ns2',
    'panel', 'pay', 'payment',
    'postgres', 'root', 'security', 'signin', 'signup', 'smtp', 'ssl', 'staff',
    'static', 'status', 'store', 'support', 'system', 'test', 'upload', 'uploads',
    'user', 'users', 'vpn', 'web', 'webmail', 'www',
})

#: What a subdomain may be made of. Also what nginx and DNS will accept.
SUBDOMAIN = re.compile(r'^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')

#: What any accepted name may be made of — one or more of those labels.
#:
#: A custom domain is not hosted on anybody's behalf, so nothing here polices
#: *which* one somebody claims. It still has to be a hostname: the first label
#: becomes a directory, via `domain.name.split('.')[0]`, so a name this module
#: waves through reaches the filesystem. `../etc` and `.ufazien.com` both used
#: to, and both resolved the site root to `/srv/hosting` itself — which is
#: every tenant's files, through the same call meant to keep them apart.
HOSTNAME = re.compile(
    r'^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?'
    r'(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
)


def base_domain() -> str:
    return getattr(settings, 'HOSTING_BASE_DOMAIN', 'ufazien.com').lower()


def normalise(name: str) -> str:
    """
    A domain name as it will be matched against.

    Lower case and without a trailing dot, because DNS is case-insensitive and
    nginx lower-cases the host before it matches. Stored as typed, `Alice` and
    `alice` were two rows that resolved to one directory — one of which nobody
    could ever serve.
    """
    return (name or '').strip().lower().rstrip('.')


def subdomain_of(name: str) -> str | None:
    """The label in front of the base domain, or None for a domain of its own."""
    name = normalise(name)
    suffix = '.' + base_domain()
    if not name.endswith(suffix):
        return None
    label = name[: -len(suffix)]
    return label or None


def site_label(name: str) -> str:
    """The directory a domain resolves to, which is not always its own.

    Every file endpoint derives the site root as `name.split('.')[0]`, so this
    is the part of a domain that decides whose files are reached. Under the
    base domain it is the subdomain and `check()` guarantees it is a single
    label. A custom domain is not constrained that way: `alice.attacker.com`
    is a perfectly good hostname whose first label is somebody else's site.
    """
    return normalise(name).split('.')[0]


def check(name: str) -> str:
    """
    The name to store, or raise `ValueError` saying why not.

    Anything not under the base domain is a custom domain, which the platform
    does not choose for anybody — but whose first label still becomes a
    directory on disk, so its syntax is checked like any other.
    """
    name = normalise(name)
    if not name:
        raise ValueError('A domain name is required.')

    if not HOSTNAME.match(name):
        raise ValueError('That is not a valid domain name.')

    label = subdomain_of(name)
    if label is None:
        return name

    if '.' in label:
        raise ValueError('A subdomain cannot contain a dot.')
    if not SUBDOMAIN.match(label):
        raise ValueError(
            'A subdomain may use lowercase letters, numbers and hyphens, '
            'and must start and end with a letter or number.'
        )
    if label in RESERVED_SUBDOMAINS:
        raise ValueError(f'“{label}” is reserved by the platform. Please choose another.')

    return name
