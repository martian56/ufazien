from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APITestCase

from users import usernames

User = get_user_model()


class EmailExposureTests(APITestCase):
    """What one user can learn about another's address."""

    def setUp(self):
        self.alice = User.objects.create_user(
            username="alice.smith", email="alice@example.com", password="pw"
        )
        self.bob = User.objects.create_user(
            username="bob.jones", email="bob@example.com", password="pw"
        )

    def test_a_stranger_gets_no_email_field(self):
        self.client.force_authenticate(user=self.bob)
        response = self.client.get(f"/api/auth/user/{self.alice.id}/")
        self.assertNotIn("alice@example.com", str(response.data))

    def test_the_owner_still_sees_their_own(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.get("/api/auth/user/me/")
        self.assertEqual(response.data.get("email"), "alice@example.com")

    def test_a_username_never_hands_out_an_address(self):
        """The leak the serializer could not stop, because it is the username."""
        leaky = User.objects.create_user(
            username="carol@example.com", email="carol@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.bob)
        response = self.client.get(f"/api/auth/user/{leaky.id}/")
        self.assertIn("@", str(response.data.get("username")))

        out = StringIO()
        call_command("backfill_usernames", "--apply", stdout=out)

        leaky.refresh_from_db()
        self.assertNotIn("@", leaky.username)
        response = self.client.get(f"/api/auth/user/{leaky.id}/")
        self.assertNotIn("carol@example.com", str(response.data))


class SignupTests(APITestCase):
    def payload(self, **over):
        body = {
            "username": "new.person",
            "first_name": "New",
            "last_name": "Person",
            "email": "new@example.com",
            "password": "a-long-enough-password",
        }
        body.update(over)
        return body

    def test_a_username_is_required(self):
        body = self.payload()
        del body["username"]
        self.assertEqual(self.client.post("/api/auth/signup/", body).status_code, 400)

    def test_the_username_is_not_derived_from_the_email(self):
        self.assertEqual(self.client.post("/api/auth/signup/", self.payload()).status_code, 200)
        user = User.objects.get(email="new@example.com")
        self.assertEqual(user.username, "new.person")
        self.assertFalse(usernames.reveals_email(user.username, user.email))

    def test_an_email_shaped_username_is_refused(self):
        response = self.client.post("/api/auth/signup/", self.payload(username="new@example.com"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_the_local_part_of_your_own_address_is_refused(self):
        response = self.client.post("/api/auth/signup/", self.payload(username="new"))
        self.assertEqual(response.status_code, 400)

    def test_a_duplicate_email_is_refused(self):
        User.objects.create_user(username="already.here", email="taken@example.com", password="pw")
        response = self.client.post("/api/auth/signup/", self.payload(email="taken@example.com"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_a_duplicate_email_of_another_case_is_refused(self):
        User.objects.create_user(username="already.here", email="taken@example.com", password="pw")
        response = self.client.post("/api/auth/signup/", self.payload(email="TAKEN@Example.COM"))
        self.assertEqual(response.status_code, 400)

    def test_a_duplicate_username_is_refused(self):
        User.objects.create_user(username="new.person", email="other@example.com", password="pw")
        response = self.client.post("/api/auth/signup/", self.payload())
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_a_reserved_username_is_refused(self):
        self.assertEqual(
            self.client.post("/api/auth/signup/", self.payload(username="admin")).status_code, 400
        )


class ChangingYourUsernameTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="old.handle", email="me@example.com", password="pw"
        )
        self.other = User.objects.create_user(
            username="someone.else", email="them@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def test_you_can_change_it(self):
        response = self.client.patch("/api/auth/user/me/", {"username": "new.handle"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "new.handle")

    def test_you_cannot_take_one_that_is_held(self):
        response = self.client.patch("/api/auth/user/me/", {"username": "someone.else"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_you_cannot_set_it_to_an_address(self):
        response = self.client.patch(
            "/api/auth/user/me/", {"username": "me@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_you_cannot_set_it_to_your_own_local_part(self):
        response = self.client.patch("/api/auth/user/me/", {"username": "me"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_you_cannot_take_another_users_email(self):
        response = self.client.patch(
            "/api/auth/user/me/", {"email": "them@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_keeping_your_own_email_is_not_a_clash(self):
        response = self.client.patch(
            "/api/auth/user/me/", {"email": "me@example.com"}, format="json"
        )
        self.assertEqual(response.status_code, 200)


class BackfillTests(APITestCase):
    def test_a_dry_run_writes_nothing(self):
        user = User.objects.create_user(
            username="dave@example.com", email="dave@example.com", password="pw",
            first_name="Dave", last_name="Smith",
        )
        call_command("backfill_usernames", stdout=StringIO())
        user.refresh_from_db()
        self.assertEqual(user.username, "dave@example.com")

    def test_it_derives_from_the_name(self):
        user = User.objects.create_user(
            username="dave@example.com", email="dave@example.com", password="pw",
            first_name="Dave", last_name="Smith",
        )
        call_command("backfill_usernames", "--apply", stdout=StringIO())
        user.refresh_from_db()
        self.assertEqual(user.username, "dave.smith")

    def test_it_generates_a_handle_when_there_is_no_name(self):
        user = User.objects.create_user(
            username="nameless@example.com", email="nameless@example.com", password="pw"
        )
        call_command("backfill_usernames", "--apply", stdout=StringIO())
        user.refresh_from_db()
        self.assertIsNone(usernames.check(user.username))
        self.assertFalse(usernames.reveals_email(user.username, user.email))

    def test_two_people_of_the_same_name_do_not_collide(self):
        one = User.objects.create_user(
            username="a@example.com", email="a@example.com", password="pw",
            first_name="Ali", last_name="Ali",
        )
        two = User.objects.create_user(
            username="b@example.com", email="b@example.com", password="pw",
            first_name="Ali", last_name="Ali",
        )
        call_command("backfill_usernames", "--apply", stdout=StringIO())
        one.refresh_from_db(); two.refresh_from_db()
        self.assertNotEqual(one.username, two.username)

    def test_it_leaves_a_clean_username_alone(self):
        safe = User.objects.create_user(
            username="martian", email="fuad@example.com", password="pw"
        )
        call_command("backfill_usernames", "--apply", stdout=StringIO())
        safe.refresh_from_db()
        self.assertEqual(safe.username, "martian")

    def test_keep_protects_a_name_that_would_otherwise_change(self):
        pinned = User.objects.create_user(
            username="keepme@example.com", email="keepme@example.com", password="pw"
        )
        call_command("backfill_usernames", "--apply", "--keep", "keepme@example.com", stdout=StringIO())
        pinned.refresh_from_db()
        self.assertEqual(pinned.username, "keepme@example.com")


class LoginSurvivesTheRenameTests(APITestCase):
    """The rename must not lock anybody out: people sign in with an address."""

    def test_login_by_email_still_works_after_the_username_changes(self):
        user = User.objects.create_user(
            username="erin@example.com", email="erin@example.com", password="a-real-password",
            first_name="Erin", last_name="Byrne",
        )
        call_command("backfill_usernames", "--apply", stdout=StringIO())
        user.refresh_from_db()
        self.assertEqual(user.username, "erin.byrne")

        response = self.client.post(
            "/api/auth/login/",
            {"email": "erin@example.com", "password": "a-real-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_login_is_not_case_sensitive_about_the_address(self):
        User.objects.create_user(
            username="frank.hill", email="frank@example.com", password="a-real-password"
        )
        response = self.client.post(
            "/api/auth/login/",
            {"email": "FRANK@example.com", "password": "a-real-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_two_accounts_on_one_address_do_not_500(self):
        """14 such pairs exist in production; `.get()` used to raise on them."""
        User.objects.create_user(username="gil.one", email="gil@example.com", password="first-password")
        User.objects.create_user(username="gil.two", email="gil@example.com", password="second-password")
        response = self.client.post(
            "/api/auth/login/",
            {"email": "gil@example.com", "password": "second-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


class GoogleDerivationTests(APITestCase):
    """What a Google sign-up is named, which is where 197 of the leaks came from."""

    def taken(self, candidate):
        return User.objects.filter(username__iexact=candidate).exists()

    def test_it_uses_the_name_google_supplies(self):
        handle = usernames.for_person("Ali", "Veliyev", self.taken)
        self.assertEqual(handle, "ali.veliyev")

    def test_it_never_uses_the_address_even_by_coincidence(self):
        """`ali.veliyev` is both the obvious handle and the address's local part."""
        handle = usernames.for_person("Ali", "Veliyev", self.taken, email="ali.veliyev@gmail.com")
        self.assertFalse(usernames.reveals_email(handle, "ali.veliyev@gmail.com"))
        self.assertIsNone(usernames.check(handle, "ali.veliyev@gmail.com"))

    def test_a_second_person_of_the_same_name_gets_a_suffix(self):
        User.objects.create_user(username="ali.veliyev", email="one@example.com", password="pw")
        self.assertEqual(usernames.for_person("Ali", "Veliyev", self.taken), "ali.veliyev2")

    def test_google_sending_no_name_still_produces_a_valid_handle(self):
        handle = usernames.for_person("", "", self.taken)
        self.assertIsNone(usernames.check(handle))
        self.assertFalse(usernames.reveals_email(handle, "someone@gmail.com"))

    def test_an_azerbaijani_name_is_not_emptied(self):
        self.assertEqual(usernames.for_person("Əlvin", "Məmmədov", self.taken), "elvin.memmedov")


class ReviewFixTests(APITestCase):
    """The five things review found, each with the failure it prevents."""

    def test_signup_without_an_email_is_refused_not_crashed(self):
        response = self.client.post(
            "/api/auth/signup/",
            {"username": "no.email", "first_name": "A", "last_name": "B", "password": "pw12345678"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_signup_with_a_blank_email_is_refused(self):
        response = self.client.post(
            "/api/auth/signup/",
            {"username": "blank.email", "email": "", "first_name": "A", "last_name": "B",
             "password": "pw12345678"},
        )
        self.assertEqual(response.status_code, 400)

    def test_a_negative_limit_is_refused(self):
        from django.core.management.base import CommandError

        User.objects.create_user(username="x@example.com", email="x@example.com", password="pw")
        with self.assertRaises(CommandError):
            call_command("backfill_usernames", "--apply", "--limit", "-1", stdout=StringIO())

    def test_a_limit_stops_after_that_many(self):
        for n in range(4):
            User.objects.create_user(
                username=f"u{n}@example.com", email=f"u{n}@example.com", password="pw"
            )
        call_command("backfill_usernames", "--apply", "--limit", "2", stdout=StringIO())
        renamed = sum(1 for u in User.objects.all() if "@" not in u.username)
        self.assertEqual(renamed, 2)

    def test_a_row_that_changed_underneath_is_left_alone(self):
        """The rename is keyed on the username it read, not on the id alone."""
        user = User.objects.create_user(
            username="race@example.com", email="race@example.com", password="pw",
            first_name="Race", last_name="Case",
        )
        User.objects.filter(pk=user.pk).update(username="chosen.by.them")
        call_command("backfill_usernames", "--apply", stdout=StringIO())
        user.refresh_from_db()
        self.assertEqual(user.username, "chosen.by.them")

    def test_the_database_refuses_a_case_insensitive_duplicate(self):
        from django.db import IntegrityError, transaction

        User.objects.create_user(username="Unique.Name", email="one@example.com", password="pw")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    username="unique.name", email="two@example.com", password="pw"
                )
