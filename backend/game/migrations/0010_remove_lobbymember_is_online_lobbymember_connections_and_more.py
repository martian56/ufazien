"""
Presence stops being a flag and becomes two facts. See `game/presence.py`.

`connections` starts at zero for every existing member, which is the truthful
answer: applying this restarts the server, and a restart closes every socket
there was. Anybody actually playing reconnects and is counted again within
seconds. Seeding it from the old `is_online` would have carried the very rows
#165 was about — members flagged online who had left — straight across.

Existing `last_seen` values are kept. They are now nullable, but only a member
created from here on can have a null one, and that is what it is for: a member
who has joined and not yet connected, held a place while their socket opens.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0009_delete_studyroom'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='lobbymember',
            name='is_online',
        ),
        migrations.AddField(
            model_name='lobbymember',
            name='connections',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='lobbymember',
            name='last_seen',
            field=models.DateTimeField(blank=True, default=None, null=True),
        ),
    ]
