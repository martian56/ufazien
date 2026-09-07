from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from api.models import NotificationPreference
from gpa.models import UserGPA
from users.management.commands.merge_duplicate_emails import (
    choose_keeper,
    freed_username,
    is_google_only,
    scoped_models,
)

User = get_user_model()


def run(*args):
    out = StringIO()
    call_command("merge_duplicate_emails", *args, stdout=out)
    return out.getvalue()


class RelationScanTests(TestCase):
    def test_it_finds_the_follower_table_both_ways(self):
        """Self-referential m2m names User twice and must be moved twice."""
        columns = [
            f.name for model, f, _ in scoped_models()
            if model._meta.db_table == "users_user_followers"
        ]
        self.assertEqual(sorted(columns), ["from_user", "to_user"])

    def test_it_reaches_through_tables(self):
        tables = {model._meta.db_table for model, _, _ in scoped_models()}
        self.assertIn("users_user_followers", tables)
        self.assertIn("community_groupmembership", tables)

    def test_it_never_returns_the_user_table_itself(self):
        tables = {model._meta.db_table for model, _, _ in scoped_models()}
        self.assertNotIn("users_user", tables)

    def test_the_per_user_singletons_carry_a_unique_key(self):
        keys = {
            model._meta.db_table: k for model, _, k in scoped_models()
            if model._meta.db_table in {"api_notificationpreference", "gpa_userinputstate"}
        }
        self.assertEqual(len(keys), 2, keys)
        for table, k in keys.items():
            self.assertTrue(k, table)


class KeeperTests(TestCase):
    def google(self, **kw):
        user = User.objects.create(**kw)
        user.set_unusable_password()
        user.save()
        return user

    def test_a_google_only_account_is_recognised(self):
        self.assertTrue(is_google_only(self.google(username="g.one", email="a@b.com")))

    def test_a_password_account_is_not(self):
        user = User.objects.create_user(username="p.one", email="c@d.com", password="pw")
        self.assertFalse(is_google_only(user))

    def test_the_password_account_wins_even_with_less_content(self):
        """Keeping the Google account would silently remove their password."""
        older = self.google(username="sara", email="s@x.com", first_name="Sara")
        newer = User.objects.create_user(username="sara2", email="s@x.com", password="pw")
        UserGPA.objects.create(user=older, name="Fall", overall_gpa=3.0)
        self.assertEqual(choose_keeper([older, newer]).pk, newer.pk)

    def test_an_explicit_keeper_is_honoured(self):
        a = self.google(username="a.one", email="e@f.com")
        b = User.objects.create_user(username="b.one", email="e@f.com", password="pw")
        self.assertEqual(choose_keeper([a, b], forced=a.pk).pk, a.pk)

    def test_an_unknown_forced_keeper_is_refused(self):
        a = self.google(username="a.two", email="g@h.com")
        with self.assertRaises(CommandError):
            choose_keeper([a], forced=999999)

    def test_the_suffixed_handle_gives_the_plain_one_back(self):
        keeper = User(username="samra.abdullayeva2")
        loser = User(username="samra.abdullayeva")
        self.assertEqual(freed_username(keeper, [loser]), "samra.abdullayeva")

    def test_an_unrelated_handle_is_not_taken(self):
        keeper = User(username="kseniya.rakhmanina")
        loser = User(username="not.xen")
        self.assertIsNone(freed_username(keeper, [loser]))


class MergeTests(TestCase):
    def setUp(self):
        self.old = User.objects.create(
            username="nigar.zeynalova", email="Nigar@Example.com", first_name="Nigar"
        )
        self.old.set_unusable_password()
        self.old.save()
        self.new = User.objects.create_user(
            username="nigar.zeynalova2", email="nigar@example.com", password="pw"
        )

    def test_a_dry_run_changes_nothing(self):
        UserGPA.objects.create(user=self.old, name="Fall", overall_gpa=3.5)
        run()
        self.assertTrue(User.objects.filter(pk=self.old.pk).exists())
        self.assertEqual(UserGPA.objects.filter(user=self.old).count(), 1)

    def test_it_matches_addresses_case_insensitively(self):
        self.assertIn("nigar", run().lower())

    def test_content_moves_and_the_loser_goes(self):
        UserGPA.objects.create(user=self.old, name="Fall", overall_gpa=3.5)
        run("--apply")
        self.assertFalse(User.objects.filter(pk=self.old.pk).exists())
        self.assertEqual(UserGPA.objects.filter(user=self.new).count(), 1)

    def test_a_per_user_singleton_does_not_break_the_merge(self):
        """Both sides own one row and the column is unique, so one must go."""
        NotificationPreference.objects.get_or_create(user=self.old)
        NotificationPreference.objects.get_or_create(user=self.new)
        run("--apply")
        self.assertEqual(NotificationPreference.objects.filter(user=self.new).count(), 1)
        self.assertFalse(User.objects.filter(pk=self.old.pk).exists())

    def test_a_singleton_moves_when_only_the_loser_has_one(self):
        NotificationPreference.objects.filter(user=self.new).delete()
        NotificationPreference.objects.get_or_create(user=self.old)
        run("--apply")
        self.assertEqual(NotificationPreference.objects.filter(user=self.new).count(), 1)

    def test_a_shared_follow_does_not_collide(self):
        target = User.objects.create_user(username="third.one", email="t@x.com", password="pw")
        self.old.following.add(target)
        self.new.following.add(target)
        run("--apply")
        self.assertEqual(self.new.following.filter(pk=target.pk).count(), 1)

    def test_a_follow_only_the_loser_had_is_kept(self):
        target = User.objects.create_user(username="forth.one", email="u@x.com", password="pw")
        self.old.following.add(target)
        run("--apply")
        self.assertTrue(self.new.following.filter(pk=target.pk).exists())

    def test_the_keeper_takes_the_freed_handle(self):
        run("--apply")
        self.new.refresh_from_db()
        self.assertEqual(self.new.username, "nigar.zeynalova")

    def test_a_blank_profile_field_is_filled_from_the_loser(self):
        run("--apply")
        self.new.refresh_from_db()
        self.assertEqual(self.new.first_name, "Nigar")

    def test_a_set_profile_field_is_not_overwritten(self):
        self.new.first_name = "Nigar K"
        self.new.save()
        run("--apply")
        self.new.refresh_from_db()
        self.assertEqual(self.new.first_name, "Nigar K")

    def test_the_survivor_can_still_log_in_with_their_password(self):
        run("--apply")
        self.new.refresh_from_db()
        self.assertTrue(self.new.check_password("pw"))

    def test_one_address_can_be_merged_alone(self):
        other_a = User.objects.create(username="solo.one", email="solo@x.com")
        other_a.set_unusable_password()
        other_a.save()
        User.objects.create_user(username="solo.two", email="solo@x.com", password="pw")
        run("--only", "nigar@example.com", "--apply")
        self.assertTrue(User.objects.filter(pk=other_a.pk).exists())
        self.assertFalse(User.objects.filter(pk=self.old.pk).exists())

    def test_an_address_held_once_is_refused(self):
        lonely = User.objects.create_user(username="lone.one", email="lone@x.com", password="pw")
        with self.assertRaises(CommandError):
            run("--only", lonely.email)

    def test_forcing_a_keeper_without_only_is_refused(self):
        with self.assertRaises(CommandError):
            run("--keep", str(self.new.pk))

    def test_nothing_is_left_sharing_an_address(self):
        run("--apply")
        remaining = (
            User.objects.exclude(email="")
            .values_list("email", flat=True)
        )
        lowered = [e.lower() for e in remaining]
        self.assertEqual(len(lowered), len(set(lowered)))


class ContentBearingClashTests(TestCase):
    """A clash is only safe to drop when nothing hangs off it.

    `average_userschemagrades` is unique on (schema, user) and holds no marks
    itself; the marks are `average_fieldgrade` rows pointing at it. Dropping
    the loser's link row to satisfy the constraint would cascade.
    """

    def setUp(self):
        from average.models import AverageSchema

        self.old = User.objects.create(username="samra", email="s@ufaz.az")
        self.old.set_unusable_password()
        self.old.save()
        self.new = User.objects.create_user(
            username="samra2", email="s@ufaz.az", password="pw"
        )
        self.schema = AverageSchema.objects.create(name="L2S1", creator=self.new)
        from average.models import SchemaField

        self.fields = [
            SchemaField.objects.create(schema=self.schema, name=f"f{i}", weight=1.0, order=i)
            for i in range(3)
        ]

    def grades_for(self, user, current):
        from average.models import FieldGrade, UserSchemaGrades

        link = UserSchemaGrades.objects.create(
            user=user, schema=self.schema, current_schema=current
        )
        for i, field in enumerate(self.fields):
            FieldGrade.objects.create(user_schema=link, field=field, grade=10.0 + i)
        return link

    def test_a_clash_carrying_marks_is_refused(self):
        from average.models import FieldGrade

        self.grades_for(self.old, True)
        self.grades_for(self.new, False)
        before = FieldGrade.objects.count()
        out = run("--apply")
        self.assertIn("would destroy content", out)
        self.assertEqual(FieldGrade.objects.count(), before)
        self.assertTrue(User.objects.filter(pk=self.old.pk).exists())

    def test_forcing_it_goes_ahead(self):
        self.grades_for(self.old, True)
        self.grades_for(self.new, False)
        run("--apply", "--force-discard")
        self.assertFalse(User.objects.filter(pk=self.old.pk).exists())

    def test_a_clash_carrying_nothing_is_still_dropped(self):
        from average.models import UserSchemaGrades

        UserSchemaGrades.objects.create(user=self.old, schema=self.schema, current_schema=True)
        UserSchemaGrades.objects.create(user=self.new, schema=self.schema, current_schema=False)
        run("--apply")
        self.assertFalse(User.objects.filter(pk=self.old.pk).exists())
        self.assertEqual(UserSchemaGrades.objects.filter(schema=self.schema).count(), 1)

    def test_an_unaffected_address_still_merges(self):
        self.grades_for(self.old, True)
        self.grades_for(self.new, False)
        other = User.objects.create(username="clean.one", email="c@ufaz.az")
        other.set_unusable_password()
        other.save()
        User.objects.create_user(username="clean.two", email="c@ufaz.az", password="pw")
        run("--apply")
        self.assertFalse(User.objects.filter(pk=other.pk).exists())
