from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory

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


class RecommendedGroupsTests(TestCase):
    """/api/community/recommended-groups/ returned 500 in production."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="carol", email="carol@example.com", password="pw"
        )
        self.other = User.objects.create_user(
            username="dave", email="dave@example.com", password="pw"
        )
        joined = Group.objects.create(
            name="Joined Group", description="one", owner=self.other,
            category="study", type="public",
        )
        GroupMembership.objects.create(user=self.user, group=joined, role="member")
        self.candidate = Group.objects.create(
            name="Candidate Group", description="two", owner=self.other,
            category="study", type="public",
        )

    def test_recommended_groups_returns_200(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get("/api/community/recommended-groups/")
        self.assertEqual(response.status_code, 200, response.content[:500])

    def test_recommended_excludes_groups_already_joined(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get("/api/community/recommended-groups/")
        names = [g["name"] for g in response.json()]
        self.assertIn("Candidate Group", names)
        self.assertNotIn("Joined Group", names)

    def test_full_groups_are_not_recommended(self):
        self.candidate.max_members = 1
        self.candidate.save()
        GroupMembership.objects.create(user=self.other, group=self.candidate, role="owner")

        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get("/api/community/recommended-groups/")
        self.assertEqual(response.status_code, 200, response.content[:500])
        names = [g["name"] for g in response.json()]
        self.assertNotIn("Candidate Group", names)


class CommunityWriteFlowTests(TestCase):
    """Exercise the create/join/post paths the UI depends on."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="erin", email="erin@example.com", password="pw"
        )
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)

    def test_create_group(self):
        response = self.client_api.post("/api/community/groups/", {
            "name": "New Study Group",
            "description": "A group for studying",
            "category": "study",
            "type": "public",
            "max_members": 20,
        }, format="json")
        self.assertIn(response.status_code, (200, 201), response.content[:400])
        self.assertIn("id", response.json(), "create must return the new group's id")

    def test_join_and_leave_group(self):
        owner = User.objects.create_user(username="frank", email="f@example.com", password="pw")
        group = Group.objects.create(
            name="Joinable", description="desc", owner=owner, type="public"
        )
        GroupMembership.objects.create(user=owner, group=group, role="owner")

        join = self.client_api.post(f"/api/community/groups/{group.id}/join/")
        self.assertIn(join.status_code, (200, 201), join.content[:400])

        leave = self.client_api.post(f"/api/community/groups/{group.id}/leave/")
        self.assertIn(leave.status_code, (200, 204), leave.content[:400])

    def test_create_forum_post_and_like(self):
        from .models import Forum

        forum = Forum.objects.create(title="General", description="general talk")
        create = self.client_api.post("/api/community/posts/", {
            "title": "Hello world",
            "content": "This is a post body",
            "forum_id": str(forum.id),
            "category": "general",
        }, format="json")
        self.assertIn(create.status_code, (200, 201), create.content[:400])

        post_id = create.json()["id"]
        like = self.client_api.post(f"/api/community/posts/{post_id}/like/")
        self.assertIn(like.status_code, (200, 201), like.content[:400])

    def test_stats_endpoint(self):
        response = self.client_api.get("/api/community/stats/")
        self.assertEqual(response.status_code, 200, response.content[:400])
