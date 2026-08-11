"""
Every model this project owns must be reachable from the admin.

Registering a model is a separate step from creating it, and nothing enforces
the pairing, so a migration can add a table that quietly never appears in the
admin. That is how CampusProp, RoomLight, PostAttachment, PostLike,
BlogPostView and UserSettings ended up invisible: six models across four
releases, each one noticed only when somebody went looking for it.
"""

from django.apps import apps
from django.contrib import admin
from django.test import SimpleTestCase

# The apps this project owns. Third-party models are their authors' business.
LOCAL_APPS = {
    "api", "blog", "users", "average", "gpa",
    "game", "ai_tools", "hosting", "community", "schedule",
}

# Models deliberately kept out of the admin belong here with a reason, so the
# next person can tell an exclusion from an oversight.
INTENTIONALLY_UNREGISTERED: dict[str, str] = {}


def local_models():
    return [m for m in apps.get_models() if m._meta.app_label in LOCAL_APPS]


class AdminCoverageTests(SimpleTestCase):
    def test_every_model_is_registered(self):
        registered = set(admin.site._registry)
        missing = [
            f"{m._meta.app_label}.{m.__name__}"
            for m in local_models()
            if m not in registered
            and f"{m._meta.app_label}.{m.__name__}" not in INTENTIONALLY_UNREGISTERED
        ]
        self.assertEqual(
            missing,
            [],
            "These models have no admin. Register them, or add them to "
            "INTENTIONALLY_UNREGISTERED with a reason:\n  " + "\n  ".join(missing),
        )

    def test_no_model_is_registered_with_a_bare_default(self):
        """
        A bare registration lists rows as "Model object (1)", which is unusable
        for anything with more than a handful of rows.
        """
        bare = []
        for model, model_admin in admin.site._registry.items():
            if model._meta.app_label not in LOCAL_APPS:
                continue
            has_config = (
                list(getattr(model_admin, "list_display", ())) != ["__str__"]
                or getattr(model_admin, "search_fields", None)
                or getattr(model_admin, "list_filter", None)
            )
            if not has_config:
                bare.append(f"{model._meta.app_label}.{model.__name__}")
        self.assertEqual(
            bare,
            [],
            "Give these a list_display, search_fields or list_filter:\n  " + "\n  ".join(bare),
        )

    def test_the_exclusion_list_has_not_gone_stale(self):
        """An exclusion for a model that no longer exists hides a real gap."""
        names = {f"{m._meta.app_label}.{m.__name__}" for m in local_models()}
        stale = [k for k in INTENTIONALLY_UNREGISTERED if k not in names]
        self.assertEqual(stale, [], f"No longer real models: {stale}")
