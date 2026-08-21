"""
Roll nginx's access logs up into the analytics table.

Run it on a timer. Everything it writes is an absolute total for the day, so
running it twice changes nothing and running it late catches up.
"""

import glob
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from hosting.access_logs import aggregate, read_lines
from hosting.models import Website, WebsiteAnalytics


class Command(BaseCommand):
    help = "Turn nginx access logs into WebsiteAnalytics rows"

    def add_arguments(self, parser):
        parser.add_argument(
            '--logs',
            default=None,
            help='Glob for the access logs (default: settings.HOSTING_ACCESS_LOGS)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Say what would be written without writing it',
        )
        parser.add_argument(
            '--count-bots',
            action='store_true',
            help='Count crawlers as visitors. They are excluded by default.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help=(
                'Write a day even when it comes out lower than what is stored. '
                'Without this a rotated-away log cannot quietly shrink a day.'
            ),
        )

    def handle(self, *args, **options):
        pattern = options['logs'] or getattr(
            settings, 'HOSTING_ACCESS_LOGS', '/var/log/hosting/access.log*'
        )
        paths = sorted(glob.glob(pattern))
        if not paths:
            self.stdout.write(self.style.WARNING(f'No access logs matched {pattern}'))
            return

        salt = getattr(settings, 'SECRET_KEY', '')
        traffic = aggregate(
            read_lines(paths),
            salt=salt,
            base=getattr(settings, 'HOSTING_BASE_DOMAIN', 'ufazien.com'),
            count_bots=options['count_bots'],
        )

        # One query rather than one per subdomain: a log covers every site on
        # the box, and most of them appear in it.
        wanted = {subdomain for subdomain, _ in traffic}
        sites = {site.name: site for site in Website.objects.filter(name__in=wanted)}

        written = 0
        skipped_unknown = set()
        shrunk = 0

        for (subdomain, day), totals in sorted(traffic.items()):
            site = sites.get(subdomain)
            if site is None:
                # A host nobody owns: a deleted site, or somebody pointing a
                # name at us. Not an error, and not ours to record.
                skipped_unknown.add(subdomain)
                continue

            row = totals.as_row()
            existing = WebsiteAnalytics.objects.filter(website=site, date=day).first()
            if (
                existing
                and not options['force']
                and row['page_views'] < existing.page_views
            ):
                # The log no longer holds the whole day — rotated, or truncated.
                # Overwriting here would lose traffic that really happened.
                shrunk += 1
                continue

            if options['dry_run']:
                self.stdout.write(
                    f"{subdomain} {day}: {row['page_views']} views, "
                    f"{row['unique_visitors']} visitors, {row['bandwidth_used']} bytes"
                )
            else:
                WebsiteAnalytics.objects.update_or_create(
                    website=site, date=day, defaults=row
                )
            written += 1

        verb = 'would write' if options['dry_run'] else 'wrote'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {written} day(s) from {len(paths)} log file(s)'
        ))
        if shrunk:
            self.stdout.write(self.style.WARNING(
                f'{shrunk} day(s) left alone because the log now holds less than '
                f'the stored total — pass --force to overwrite them anyway'
            ))
        if skipped_unknown:
            self.stdout.write(
                f'ignored {len(skipped_unknown)} host(s) with no website: '
                + ', '.join(sorted(skipped_unknown)[:5])
            )
