"""
Tell followers about posts whose scheduled time has arrived.

Scheduling here is a date in the future and a clock filter — `visible_to`
compares `published_at` against `now()` rather than a worker flipping a flag.
That works for reading the post and not for announcing it: nothing saves the
row at the moment it goes live, so the publish signal never fires again and
the followers of a scheduled post would never hear about it.

Run it on a timer if scheduled posts matter; the announcement is late by at
most the gap between runs. Nothing breaks without it — a post published now
still announces itself on the spot, through the same code.
"""

from django.core.management.base import BaseCommand

from api.services.notification_service import NotificationService
from blog.models import BlogPost


class Command(BaseCommand):
    help = "Notify followers about scheduled posts that have since gone live"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Say what would be announced without notifying anybody',
        )

    def handle(self, *args, **options):
        due = BlogPost.objects.filter(
            followers_notified_at__isnull=True,
            is_published=True,
            author__isnull=False,
        ).select_related('author')

        announced = 0
        for post in due:
            # `is_announceable` is the same question the signal asks, so a post
            # that is scheduled, unlisted or private is skipped here too rather
            # than being decided twice in two places.
            if not post.is_announceable:
                continue
            if options['dry_run']:
                self.stdout.write(f'would announce: {post.title} (by {post.author})')
                announced += 1
                continue
            if NotificationService.announce_new_post(post):
                announced += 1

        verb = 'would announce' if options['dry_run'] else 'announced'
        self.stdout.write(self.style.SUCCESS(f'{verb} {announced} post(s)'))
