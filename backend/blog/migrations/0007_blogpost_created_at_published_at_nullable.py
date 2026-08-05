"""Separate "when it was written" from "when it went live".

`published_at` was `auto_now_add`, so it recorded creation. A draft started on
Monday and published on Friday claimed Monday, and the feed ordered by it put a
freshly published post wherever it happened to have been started.

`created_at` now records creation, and `published_at` is stamped when a post is
actually published. Existing rows keep their old timestamp as both, which is
correct: with no draft support until now, everything was published on creation.

Written by hand rather than generated: adding an `auto_now_add` column to a
populated table makes `makemigrations` stop and ask for a one-off default
interactively.
"""

import django.utils.timezone
from django.db import migrations, models


def backfill_created_at(apps, schema_editor):
    """Existing posts were published the moment they were created."""
    BlogPost = apps.get_model('blog', 'BlogPost')
    for post in BlogPost.objects.all().iterator():
        if post.published_at:
            BlogPost.objects.filter(pk=post.pk).update(created_at=post.published_at)


def clear_published_at_on_drafts(apps, schema_editor):
    """An unpublished post has no publication date."""
    BlogPost = apps.get_model('blog', 'BlogPost')
    BlogPost.objects.filter(is_published=False).update(published_at=None)


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0006_alter_category_options_alter_tag_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='blogpost',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='blogpost',
            name='published_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_created_at, migrations.RunPython.noop),
        migrations.RunPython(clear_published_at_on_drafts, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name='blogpost',
            options={'ordering': ['-published_at', '-created_at']},
        ),
    ]
