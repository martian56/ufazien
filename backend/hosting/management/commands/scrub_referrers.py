"""
Reduce stored referrers to their origin.

A `Referer` carries the full URL of the page somebody was on, and that URL
belongs to a different site than the one being reported to — its path and query
can hold a reset token, an unsubscribe link, or somebody's email address.
Aggregation keeps only the origin now; this is for rows written before it did.

Safe to run more than once: an origin reduces to itself.
"""

from django.core.management.base import BaseCommand

from hosting.access_logs import referrer_origin
from hosting.models import WebsiteAnalytics


class Command(BaseCommand):
    help = "Reduce already-stored referrers to scheme and host"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true', help='Say what would change, and change nothing'
        )

    def handle(self, *args, **options):
        changed = 0
        for row in WebsiteAnalytics.objects.exclude(referrers=[]).iterator():
            merged = {}
            for entry in row.referrers or []:
                origin = referrer_origin(entry.get('referrer', ''))
                if not origin:
                    continue
                merged[origin] = merged.get(origin, 0) + entry.get('visits', 0)

            tidied = [
                {'referrer': origin, 'visits': visits}
                for origin, visits in sorted(merged.items(), key=lambda kv: -kv[1])
            ]
            if tidied == row.referrers:
                continue

            changed += 1
            if options['dry_run']:
                self.stdout.write(f'{row.website_id} {row.date}: {len(row.referrers)} -> {len(tidied)}')
            else:
                row.referrers = tidied
                row.save(update_fields=['referrers'])

        verb = 'would tidy' if options['dry_run'] else 'tidied'
        self.stdout.write(self.style.SUCCESS(f'{verb} {changed} row(s)'))
