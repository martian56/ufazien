"""
Record when a post's followers were told about it — and treat every post that
already exists as already announced.

Without the backfill, every published post on the platform has a null here,
which reads as "nobody has been told". Editing a post written a year ago would
then announce it to the author's followers as new, and a single run of
`announce_scheduled_posts` would mail out the entire back catalogue.

They are stamped with the date they went live rather than now, so the column
says something true about each post rather than about this deployment.

A post scheduled for a date still in the future is left alone. It has not gone
live, so nobody has been told about it and nobody should be: stamping it here
would have taken it out of `announce_scheduled_posts` for ever, and its
followers would never hear about it at all.
"""

from django.db import migrations, models
from django.db.models import F, Q
from django.utils import timezone


def treat_existing_posts_as_announced(apps, schema_editor):
    BlogPost = apps.get_model('blog', 'BlogPost')
    now = timezone.now()
    live = BlogPost.objects.filter(
        is_published=True, followers_notified_at__isnull=True
    ).filter(Q(published_at__isnull=True) | Q(published_at__lte=now))
    live.filter(published_at__isnull=False).update(followers_notified_at=F('published_at'))
    live.filter(published_at__isnull=True).update(followers_notified_at=now)


def unstamp(apps, schema_editor):
    """Reversing this drops the column, so there is nothing to undo first."""


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0008_blogpost_visibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='blogpost',
            name='followers_notified_at',
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.RunPython(treat_existing_posts_as_announced, unstamp),
    ]
