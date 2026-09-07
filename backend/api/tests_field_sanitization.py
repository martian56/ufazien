from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from api.sanitize import plain_text

User = get_user_model()

PAYLOAD = '<img src=x onerror=alert(1)><script>alert(2)</script>Study Group'


class PlainTextTests(TestCase):
    def test_markup_is_removed(self):
        self.assertEqual(plain_text("<b>bold</b> text"), "bold text")

    def test_a_script_body_survives_only_as_text(self):
        self.assertEqual(plain_text("<script>alert(1)</script>"), "alert(1)")

    def test_an_event_handler_leaves_nothing_behind(self):
        self.assertEqual(plain_text("<img src=x onerror=alert(1)>"), "")

    def test_an_escaped_tag_cannot_be_smuggled_back(self):
        self.assertEqual(plain_text("&lt;script&gt;alert(1)&lt;/script&gt;"), "alert(1)")

    def test_a_comparison_is_left_alone(self):
        self.assertEqual(plain_text("a < b and c > d"), "a < b and c > d")

    def test_an_emoticon_is_left_alone(self):
        self.assertEqual(plain_text("I <3 this"), "I <3 this")

    def test_an_ampersand_is_a_character_not_an_entity(self):
        self.assertEqual(plain_text("Ali & Co"), "Ali & Co")

    def test_accents_and_azerbaijani_letters_survive(self):
        self.assertEqual(plain_text("Café Əli"), "Café Əli")

    def test_whitespace_is_collapsed(self):
        self.assertEqual(plain_text("  lots   of   space  "), "lots of space")

    def test_paragraphs_can_be_kept(self):
        self.assertEqual(plain_text("a\n\n\n\nb", keep_newlines=True), "a\n\nb")

    def test_it_truncates(self):
        self.assertEqual(len(plain_text("x" * 50, max_length=10)), 10)

    def test_nothing_at_all_is_handled(self):
        self.assertEqual(plain_text(None), "")
        self.assertEqual(plain_text(""), "")


class StoredFieldTests(APITestCase):
    """The fields the assessment named, checked at the API boundary."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="tester.one", email="tester@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def assertInert(self, value):
        text = str(value)
        self.assertNotIn("<script", text.lower())
        self.assertNotIn("onerror", text.lower())
        self.assertNotIn("<img", text.lower())

    def test_a_profile_bio_is_stored_inert(self):
        response = self.client.patch(
            "/api/auth/user/me/", {"bio": PAYLOAD}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertInert(self.user.bio)

    def test_a_name_is_stored_inert(self):
        response = self.client.patch(
            "/api/auth/user/me/", {"first_name": PAYLOAD}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertInert(self.user.first_name)

    def test_a_community_group_name_is_stored_inert(self):
        response = self.client.post(
            "/api/community/groups/",
            {"name": PAYLOAD, "description": PAYLOAD, "category": "study", "type": "public"},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertInert(response.data.get("name"))
        self.assertInert(response.data.get("description"))

    def test_feedback_is_stored_inert(self):
        response = self.client.post(
            "/api/feedback/",
            {"feedback_type": "bug", "subject": PAYLOAD, "message": PAYLOAD},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertInert(response.data.get("subject"))
        self.assertInert(response.data.get("message"))

    def test_the_readable_part_of_the_payload_is_kept(self):
        """Sanitising must not swallow what the person actually wrote."""
        self.client.patch("/api/auth/user/me/", {"bio": PAYLOAD}, format="json")
        self.user.refresh_from_db()
        self.assertIn("Study Group", self.user.bio)


class WritePathTests(APITestCase):
    """The write path is often a different serializer from the read path."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="writer.one", email="writer@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def test_every_write_serializer_declares_its_text_fields(self):
        from api.sanitize import PlainTextFieldsMixin
        from community import serializers as cs

        for name in [
            "GroupCreateSerializer", "GroupMessageSerializer", "ForumSerializer",
            "ForumPostCreateSerializer", "PrivateMessageSerializer",
        ]:
            cls = getattr(cs, name)
            self.assertTrue(issubclass(cls, PlainTextFieldsMixin), name)
            self.assertTrue(cls.plain_text_fields, name)

    def test_the_mixin_cleans_what_it_declares(self):
        from community.serializers import GroupCreateSerializer

        serializer = GroupCreateSerializer(
            data={"name": PAYLOAD, "description": PAYLOAD, "category": "study", "type": "public"}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("<script", serializer.validated_data["name"])
        self.assertNotIn("onerror", serializer.validated_data["name"])
        self.assertIn("Study Group", serializer.validated_data["name"])

    def test_a_forum_post_is_cleaned_on_the_way_in(self):
        from community.serializers import ForumPostCreateSerializer

        serializer = ForumPostCreateSerializer(data={"title": PAYLOAD, "content": PAYLOAD})
        serializer.is_valid()
        self.assertNotIn("<script", str(serializer.validated_data.get("title", "")))
        self.assertNotIn("<script", str(serializer.validated_data.get("content", "")))

    def test_a_lobby_name_is_cleaned(self):
        from game.serializers import LobbyCreateSerializer

        serializer = LobbyCreateSerializer(data={"name": PAYLOAD, "description": PAYLOAD})
        serializer.is_valid()
        self.assertNotIn("<script", str(serializer.validated_data.get("name", "")))
