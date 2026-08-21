"""
Turning what nginx already writes into a day of traffic.

The analytics page has never shown anybody their own numbers. `WebsiteAnalytics`
existed and the read endpoints queried it correctly, but the only thing that
could write to it was a webhook nothing has ever called — so the table stayed
empty and the endpoint fell back to `random.randint` figures.

nginx is already logging every request to every user site. This reads those
lines and rolls them into one row per site per day, which needs no change to
anybody's website, counts static files as well as pages, and is the only source
that can account for bandwidth honestly — the same bandwidth the hosting quota
is spent on.

What it deliberately does not produce is `bounce_rate` and `avg_session_duration`.
A log line is a request, not a session; working those out needs a script running
on the page. They stay at zero rather than being invented, which is the whole
problem this replaces.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Iterable, Iterator

#: Requests for these are traffic and bandwidth, but not page views. Somebody
#: reading one page of a site pulls a dozen of them, and counting each as a view
#: turns "12 people read the news page" into 150.
ASSET_SUFFIXES = (
    '.css', '.js', '.mjs', '.map',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.bmp',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.mp4', '.webm', '.mp3', '.ogg', '.wav',
    '.pdf', '.zip', '.gz', '.json', '.xml', '.txt',
)

#: How many of each to keep. The page shows a handful; storing hundreds makes
#: the row big and tells nobody anything.
TOP_N = 10

#: Anything that says it is a bot. Crawlers are most of the traffic to a small
#: site and counting them as visitors makes the whole page a lie.
_BOT = re.compile(
    r'bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|'
    r'headlesschrome|python-requests|curl/|wget/|monitoring|uptime|pingdom',
    re.IGNORECASE,
)


def is_bot(user_agent: str) -> bool:
    return bool(user_agent and _BOT.search(user_agent))


#: Tablets first: an iPad says "Macintosh" and most Android tablets say
#: "Android", so asking the mobile question first calls every one of them a
#: phone.
_TABLET = re.compile(r'ipad|tablet|kindle|silk|playbook|nexus (?:7|9|10)', re.IGNORECASE)
_MOBILE = re.compile(r'mobi|iphone|ipod|android|windows phone|blackberry|opera mini', re.IGNORECASE)


def device_of(user_agent: str) -> str:
    """
    Roughly what somebody was reading on.

    Rough on purpose: user agents lie, and the panel this feeds shows three
    bars. It is a great deal closer than the invented percentages it replaces.
    """
    if not user_agent:
        return 'desktop'
    if _TABLET.search(user_agent):
        return 'tablet'
    if _MOBILE.search(user_agent):
        return 'mobile'
    return 'desktop'


def is_page(path: str) -> bool:
    """Whether this request is somebody looking at a page."""
    clean = path.split('?', 1)[0].split('#', 1)[0].lower().rstrip('/')
    if not clean:
        return True  # "/" is the home page
    return not clean.endswith(ASSET_SUFFIXES)


def clean_host(host: str) -> str | None:
    """
    The host a request was for, tidied up.

    The host is kept whole rather than being cut down to a subdomain. Which
    site it belongs to is a question for the database — a site can be on
    `portfolio.ufazien.com` or on a domain of its own, and both are hosts we
    serve. Reducing it here threw the second kind away.
    """
    if not host:
        return None
    host = host.split(':', 1)[0].strip().lower().rstrip('.')
    return host or None


def subdomain_of(host: str, base: str = 'ufazien.com') -> str | None:
    """
    The subdomain part of one of our own hosts, or None for anything else.

    Only used to fall back to `Website.name` for a site that has no `Domain`
    row. It is *not* how a site is normally found: `Website.name` is the label
    the user typed — "My Portfolio" — while the subdomain lives on `Domain`,
    and deployment roots the site's directory at the domain's name. Matching on
    `Website.name` therefore missed every site made through the UI, which is
    all of them, and reported zero.
    """
    cleaned = clean_host(host)
    if not cleaned:
        return None
    suffix = '.' + base.lower()
    if not cleaned.endswith(suffix):
        return None
    name = cleaned[: -len(suffix)]
    return name or None


def visitor_key(ip: str, day: date, salt: str) -> str:
    """
    One visitor, without keeping their address.

    Counting unique visitors needs to tell two requests apart, not to know who
    made them — so the address is hashed, and salted per day so the same hash
    cannot be followed from one day to the next.
    """
    return hashlib.sha256(f'{salt}:{day.isoformat()}:{ip}'.encode()).hexdigest()[:32]


@dataclass
class DayTraffic:
    """One site, one day, accumulated."""

    page_views: int = 0
    bandwidth_used: int = 0
    visitors: set[str] = field(default_factory=set)
    pages: Counter = field(default_factory=Counter)
    referrers: Counter = field(default_factory=Counter)
    devices: Counter = field(default_factory=Counter)

    def as_row(self) -> dict:
        return {
            'page_views': self.page_views,
            'unique_visitors': len(self.visitors),
            'bandwidth_used': self.bandwidth_used,
            'top_pages': [
                {'path': path, 'views': views}
                for path, views in self.pages.most_common(TOP_N)
            ],
            'referrers': [
                {'referrer': referrer, 'visits': visits}
                for referrer, visits in self.referrers.most_common(TOP_N)
            ],
            'devices': dict(self.devices),
        }


def parse_line(line: str) -> dict | None:
    """
    One log line, or None if it is not one.

    nginx writes these itself with `escape=json`, but a log is a file on a disk
    that gets truncated, rotated and half-written — a malformed line is normal
    and must not stop the run.
    """
    line = line.strip()
    if not line:
        return None
    try:
        entry = json.loads(line)
    except (ValueError, TypeError):
        return None
    return entry if isinstance(entry, dict) else None


def entry_date(entry: dict) -> date | None:
    stamp = entry.get('t') or entry.get('time')
    if not stamp:
        return None
    try:
        # nginx's $time_iso8601 has no colon in the offset, which
        # `fromisoformat` rejects before Python 3.11 and accepts after.
        return datetime.fromisoformat(str(stamp)).date()
    except ValueError:
        try:
            return datetime.strptime(str(stamp)[:10], '%Y-%m-%d').date()
        except ValueError:
            return None


def aggregate(
    lines: Iterable[str],
    salt: str,
    count_bots: bool = False,
) -> dict[tuple[str, date], DayTraffic]:
    """
    Roll log lines up into (host, day) totals.

    Keyed by host, not by subdomain: a site can be on `x.ufazien.com` or on a
    domain of its own, and cutting the host down to a subdomain dropped the
    second kind on the floor. Which site a host belongs to is a question for
    the database — see `sites_by_host`.

    Absolute totals for whatever it is given, not increments — so running it
    twice over the same log produces the same answer rather than doubling it,
    which is what the webhook it replaces got wrong.
    """
    traffic: dict[tuple[str, date], DayTraffic] = defaultdict(DayTraffic)

    for line in lines:
        entry = parse_line(line)
        if entry is None:
            continue

        host = clean_host(str(entry.get('host', '')))
        day = entry_date(entry)
        if not host or day is None:
            continue

        into = traffic[(host, day)]

        # Bandwidth is every byte that left, whatever the response was and
        # whoever asked: a 404 page, a redirect and a crawler all cost the
        # quota, and the quota is what this figure is checked against. Counted
        # before the crawler filter for exactly that reason — a site that only
        # ever gets crawled has bandwidth and no readers, and both are true.
        try:
            into.bandwidth_used += max(0, int(entry.get('bytes', 0) or 0))
        except (TypeError, ValueError):
            pass

        # Past here is readership, which a crawler is not.
        if not count_bots and is_bot(str(entry.get('ua', ''))):
            continue

        try:
            status = int(entry.get('status', 0) or 0)
        except (TypeError, ValueError):
            status = 0

        path = str(entry.get('uri', '') or '')
        # A view is a page that was actually served. Errors and redirects are
        # traffic, not readership.
        if 200 <= status < 300 and is_page(path):
            into.page_views += 1
            into.pages[path.split('?', 1)[0][:200]] += 1

            ip = str(entry.get('ip', '') or '')
            if ip:
                into.visitors.add(visitor_key(ip, day, salt))

            into.devices[device_of(str(entry.get('ua', '')))] += 1

            referrer = str(entry.get('ref', '') or '').strip()
            # `-` is nginx for "there wasn't one", and a site's own pages are
            # not referrers to itself.
            if referrer and referrer != '-' and f'//{host}' not in referrer:
                into.referrers[referrer[:200]] += 1

    return dict(traffic)


def read_lines(paths: Iterable[str]) -> Iterator[str]:
    """Every line of every log given, skipping any that cannot be opened."""
    import gzip
    import os

    for path in paths:
        if not os.path.exists(path):
            continue
        try:
            opener = gzip.open if path.endswith('.gz') else open
            with opener(path, 'rt', encoding='utf-8', errors='replace') as handle:
                yield from handle
        except OSError:
            continue


def sites_by_host(hosts, base='ufazien.com'):
    """
    Which `Website` each host belongs to.

    The subdomain is on `Domain`, not on `Website`. `Website.name` is the label
    the user typed on step one of the create form — "My Portfolio" — and the
    subdomain is the separate field beside it, saved as a `Domain` row. What
    deployment roots a site's directory at, and therefore what nginx serves it
    under and what turns up as `$host` in the log, is the domain's name:

        subdomain = instance.domain.name.split('.')[0]   # hosting/views.py

    Matching a host against `Website.name` therefore missed every site made
    through the UI and reported zero for it, in silence. `Website.url` has the
    same two branches and I read only the second one.

    The fallback is kept because it is real: a site with no `Domain` row is
    served from a directory named after `Website.name`, by the `else` in that
    same code. Those are the only ones the old lookup ever found — and the only
    ones the tests built, which is why they were green.

    One query, because a log covers every site on the box.
    """
    from django.db.models import Q

    from .models import Website

    hosts = {h for h in (clean_host(h) for h in hosts) if h}
    if not hosts:
        return {}

    # Sites on one of our subdomains, by the label they were given, for the
    # ones that never got a domain row.
    subdomains = {sub for sub in (subdomain_of(h, base) for h in hosts) if sub}

    found = {}
    query = Website.objects.filter(
        Q(domain__name__in=hosts) | Q(domain__isnull=True, name__in=subdomains)
    ).select_related('domain')

    for site in query:
        if site.domain and site.domain.name:
            found[clean_host(site.domain.name)] = site
        else:
            found[f'{site.name.lower()}.{base}'] = site

    return found
