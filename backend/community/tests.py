from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from .models import Group, GroupMembership
from .serializers import (
    GroupMembershipSerializer,
    UserBasicSerializer,
    UserProfileSerializer,
)

User = get_user_model()


class EmailVisibilityTests(TestCase):
    """A user's email must never reach another user."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.alice = User.objects.create_user(
            username="alice", email="alice@example.com", password="pw"
        )
        self.bob = User.objects.create_user(
            username="bob", email="bob@example.com", password="pw"
        )

    def _serialize(self, serializer_cls, target, viewer):
        request = self.factory.get("/")
        request.user = viewer
        return serializer_cls(target, context={"request": request}).data

    def test_own_email_is_visible(self):
        for serializer_cls in (UserBasicSerializer, UserProfileSerializer):
            with self.subTest(serializer=serializer_cls.__name__):
                data = self._serialize(serializer_cls, self.alice, self.alice)
                self.assertEqual(data["email"], "alice@example.com")

    def test_other_users_email_is_hidden(self):
        for serializer_cls in (UserBasicSerializer, UserProfileSerializer):
            with self.subTest(serializer=serializer_cls.__name__):
                data = self._serialize(serializer_cls, self.bob, self.alice)
                self.assertIsNone(data["email"])

    def test_email_hidden_without_request_context(self):
        """Consumers serialize without a request; that must not leak either."""
        for serializer_cls in (UserBasicSerializer, UserProfileSerializer):
            with self.subTest(serializer=serializer_cls.__name__):
                data = serializer_cls(self.bob).data
                self.assertIsNone(data["email"])

    def test_email_hidden_from_anonymous(self):
        from django.contrib.auth.models import AnonymousUser

        data = self._serialize(UserBasicSerializer, self.bob, AnonymousUser())
        self.assertIsNone(data["email"])

    def test_group_members_do_not_leak_emails(self):
        """Through the serializer actually used for group member lists."""
        group = Group.objects.create(
            name="Test Group", description="a description", owner=self.bob
        )
        GroupMembership.objects.create(user=self.bob, group=group, role="owner")
        GroupMembership.objects.create(user=self.alice, group=group, role="member")

        request = self.factory.get("/")
        request.user = self.alice
        rows = GroupMembershipSerializer(
            GroupMembership.objects.filter(group=group),
            many=True,
            context={"request": request},
        ).data

        emails = {row["user"]["email"] for row in rows}
        self.assertNotIn("bob@example.com", emails)
        self.assertIn("alice@example.com", emails)
