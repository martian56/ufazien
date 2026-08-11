"""
Tests for the channel layer selection.

The bug this prevents: InMemoryChannelLayer only reaches consumers inside one
process. With more than one uvicorn worker, two students on different workers
cannot see each other's chat messages or campus movement, and nothing errors,
so it looks like the socket simply went quiet.
"""

import importlib

from django.test import SimpleTestCase


def channel_layer_for(redis_url):
    """Re-evaluate the settings branch the way a fresh process would."""
    if redis_url:
        return {
            'default': {
                'BACKEND': 'channels_redis.core.RedisChannelLayer',
                'CONFIG': {'hosts': [redis_url]},
            },
        }
    return {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}


class ChannelLayerSelectionTests(SimpleTestCase):
    def test_redis_is_used_when_a_url_is_set(self):
        layers = channel_layer_for("redis://:pw@somehost:6379/0")
        self.assertEqual(
            layers['default']['BACKEND'],
            'channels_redis.core.RedisChannelLayer',
        )
        self.assertEqual(layers['default']['CONFIG']['hosts'], ["redis://:pw@somehost:6379/0"])

    def test_in_memory_is_the_fallback(self):
        """Local development and the test suite must not require Redis."""
        layers = channel_layer_for("")
        self.assertEqual(
            layers['default']['BACKEND'],
            'channels.layers.InMemoryChannelLayer',
        )

    def test_settings_match_the_environment(self):
        from django.conf import settings

        expected = channel_layer_for(settings.REDIS_URL)
        self.assertEqual(settings.CHANNEL_LAYERS, expected)

    def test_channels_redis_is_installed(self):
        """It is declared in requirements.txt; a missing wheel fails at runtime."""
        self.assertIsNotNone(importlib.import_module("channels_redis"))
