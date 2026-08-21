"""
Roll nginx's access logs up into the analytics table.

Run it on a timer. Everything it writes is an absolute total for the day, so
running it twice changes nothing and running it late catches up.
"""

import glob
import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Sum

from hosting.access_logs import aggregate, read_lines, sites_by_host
from hosting.models import WebsiteAnalytics


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
        base = getattr(settings, 'HOSTING_BASE_DOMAIN', 'ufazien.com')
        traffic = aggregate(
            read_lines(paths),
            salt=salt,
            count_bots=options['count_bots'],
        )

        # By host, through the domain. `Website.name` is the label the user
        # typed, not the subdomain — see `sites_by_host`.
        sites = sites_by_host({host for host, _ in traffic}, base)

        written = 0
        skipped_unknown = set()
        shrunk = 0

        for (host, day), totals in sorted(traffic.items()):
            site = sites.get(host)
            if site is None:
                # A host nobody owns: a deleted site, or somebody pointing a
                # name at us. Not an error, and not ours to record — but said
                # out loud, because a site quietly reporting nothing is the
                # failure this command had.
                skipped_unknown.add(host)
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
                    f"{host} {day}: {row['page_views']} views, "
                    f"{row['unique_visitors']} visitors, {row['bandwidth_used']} bytes"
                )
            else:
                WebsiteAnalytics.objects.update_or_create(
                    website=site, date=day, defaults=row
                )
            written += 1

        # `Website.total_visits` is read by the site's own page, by the
        # dashboard's total, and by the public listing — which is *ordered* by
        # it. Nothing has ever written it, so it was zero everywhere and that
        # ordering meant nothing. Recomputed from the days rather than added
        # to, for the same reason every other figure here is: running this
        # twice must not double anybody's traffic.
        if not options['dry_run'] and written:
            for site in set(sites.values()):
                total = WebsiteAnalytics.objects.filter(website=site).aggregate(
                    total=Sum('page_views')
                )['total'] or 0
                if site.total_visits != total:
                    site.total_visits = total
                    site.save(update_fields=['total_visits'])

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
