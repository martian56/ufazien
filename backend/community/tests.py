import tempfile

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
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


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="ufazien-test-media-"))
class PostAttachmentTests(TestCase):
    """Images on forum posts.

    MEDIA_ROOT is redirected to a temp directory: without it these uploads
    would accumulate in the real media folder on every test run.

    ForumPost could only ever show text, while GroupMessage already carried
    images and files.
    """

    def setUp(self):
        from .models import Forum, ForumPost

        self.author = User.objects.create_user(
            username="author", email="author@example.com", password="pw"
        )
        self.other = User.objects.create_user(
            username="other", email="other@example.com", password="pw"
        )
        self.forum = Forum.objects.create(title="General", description="general talk")
        self.post = ForumPost.objects.create(
            forum=self.forum,
            author=self.author,
            title="A post with pictures",
            content="Body text",
        )
        self.client_api = APIClient()

    def _png(self, name="shot.png"):
        """A real one-pixel PNG, since ImageField verifies the file."""
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (1, 1), "blue").save(buffer, format="PNG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")

    def test_author_can_attach_an_image(self):
        self.client_api.force_authenticate(user=self.author)
        response = self.client_api.post(
            f"/api/community/posts/{self.post.id}/attachments/",
            {"image": self._png(), "caption": "A diagram"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.content[:400])
        self.assertEqual(response.json()["caption"], "A diagram")
        self.assertEqual(self.post.attachments.count(), 1)

    def test_attachments_appear_on_the_post(self):
        self.client_api.force_authenticate(user=self.author)
        self.client_api.post(
            f"/api/community/posts/{self.post.id}/attachments/",
            {"image": self._png()},
            format="multipart",
        )

        response = self.client_api.get(f"/api/community/posts/{self.post.id}/")
        self.assertEqual(response.status_code, 200, response.content[:400])
        self.assertEqual(len(response.json()["attachments"]), 1)

    def test_another_user_cannot_attach_to_someone_elses_post(self):
        self.client_api.force_authenticate(user=self.other)
        response = self.client_api.post(
            f"/api/community/posts/{self.post.id}/attachments/",
            {"image": self._png()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403, response.content[:400])
        self.assertEqual(self.post.attachments.count(), 0)

    def test_a_request_without_a_file_is_rejected(self):
        self.client_api.force_authenticate(user=self.author)
        response = self.client_api.post(
            f"/api/community/posts/{self.post.id}/attachments/",
            {"caption": "no file"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400, response.content[:400])

    def test_attachments_keep_their_order(self):
        self.client_api.force_authenticate(user=self.author)
        for name in ("first.png", "second.png", "third.png"):
            self.client_api.post(
                f"/api/community/posts/{self.post.id}/attachments/",
                {"image": self._png(name)},
                format="multipart",
            )

        positions = list(self.post.attachments.values_list("position", flat=True))
        self.assertEqual(positions, [0, 1, 2])


class ReplyThreadTests(TestCase):
    """Threaded replies.

    PostReply.parent_reply has always existed, but the replies endpoint filtered
    to parent_reply=None and the nested serializer was commented out, so a reply
    to a reply was stored and never sent to anyone.
    """

    def setUp(self):
        from .models import Forum, ForumPost

        self.user = User.objects.create_user(
            username="threader", email="threader@example.com", password="pw"
        )
        self.forum = Forum.objects.create(title="General", description="general talk")
        self.post = ForumPost.objects.create(
            forum=self.forum, author=self.user, title="A question", content="Body"
        )
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)

    def _reply(self, content, parent=None):
        payload = {"post": str(self.post.id), "content": content}
        if parent:
            payload["parent_reply"] = str(parent)
        response = self.client_api.post("/api/community/replies/", payload, format="json")
        self.assertIn(response.status_code, (200, 201), response.content[:400])
        return response.json()

    def test_a_nested_reply_is_returned(self):
        top = self._reply("Top level")
        self._reply("A reply to the reply", parent=top["id"])

        response = self.client_api.get(f"/api/community/posts/{self.post.id}/replies/")
        self.assertEqual(response.status_code, 200, response.content[:400])

        body = response.json()
        items = body["results"] if isinstance(body, dict) else body
        self.assertEqual(len(items), 2, "the nested reply was dropped")

    def test_each_reply_carries_its_parent(self):
        top = self._reply("Top level")
        child = self._reply("Child", parent=top["id"])

        self.assertIsNone(top["parent_reply"])
        self.assertEqual(str(child["parent_reply"]), str(top["id"]))

    def test_the_thread_can_be_rebuilt_from_the_flat_list(self):
        top = self._reply("Top")
        child = self._reply("Child", parent=top["id"])
        self._reply("Grandchild", parent=child["id"])

        response = self.client_api.get(f"/api/community/posts/{self.post.id}/replies/")
        body = response.json()
        items = body["results"] if isinstance(body, dict) else body

        by_parent = {}
        for item in items:
            by_parent.setdefault(item["parent_reply"], []).append(item)

        roots = by_parent.get(None, [])
        self.assertEqual(len(roots), 1)
        self.assertEqual(len(by_parent.get(roots[0]["id"], [])), 1)

    def test_replies_are_oldest_first(self):
        self._reply("First")
        self._reply("Second")

        response = self.client_api.get(f"/api/community/posts/{self.post.id}/replies/")
        body = response.json()
        items = body["results"] if isinstance(body, dict) else body
        self.assertEqual([i["content"] for i in items], ["First", "Second"])


class ReactionPermissionTests(TestCase):
    """Liking and bookmarking someone else's post.

    CommunityPermission checked ownership for every unsafe method, and like and
    bookmark are POSTs, so they fell through to `obj.author == request.user`:
    reacting to anybody else's post answered 403 and the only post you could
    like was your own, which is not what a like button is for.
    """

    def setUp(self):
        from .models import Forum, ForumPost

        self.author = User.objects.create_user(
            username="author", email="author@example.com", password="pw"
        )
        self.reader = User.objects.create_user(
            username="reader", email="reader@example.com", password="pw"
        )
        self.forum = Forum.objects.create(title="General", description="general talk")
        self.post = ForumPost.objects.create(
            forum=self.forum, author=self.author, title="Worth reading", content="Body"
        )
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.reader)

    def test_another_users_post_can_be_liked(self):
        response = self.client_api.post(f"/api/community/posts/{self.post.id}/like/")

        self.assertEqual(response.status_code, 200, response.content[:400])
        self.assertTrue(response.json()["liked"])
        self.assertEqual(response.json()["like_count"], 1)

    def test_liking_twice_removes_the_like(self):
        self.client_api.post(f"/api/community/posts/{self.post.id}/like/")
        response = self.client_api.post(f"/api/community/posts/{self.post.id}/like/")

        self.assertEqual(response.status_code, 200, response.content[:400])
        self.assertFalse(response.json()["liked"])
        self.assertEqual(response.json()["like_count"], 0)

    def test_another_users_post_can_be_bookmarked(self):
        response = self.client_api.post(f"/api/community/posts/{self.post.id}/bookmark/")

        self.assertEqual(response.status_code, 200, response.content[:400])
        self.assertTrue(response.json()["bookmarked"])

    def test_another_users_reply_can_be_liked(self):
        from .models import PostReply

        reply = PostReply.objects.create(
            post=self.post, author=self.author, content="I agree"
        )

        response = self.client_api.post(f"/api/community/replies/{reply.id}/like/")

        self.assertEqual(response.status_code, 200, response.content[:400])
        self.assertTrue(response.json()["liked"])

    def test_another_users_post_still_cannot_be_edited(self):
        """Loosening reactions must not loosen editing."""
        response = self.client_api.patch(
            f"/api/community/posts/{self.post.id}/",
            {"title": "Hijacked"},
            format="json",
        )

        self.assertEqual(response.status_code, 403, response.content[:400])
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, "Worth reading")

    def test_another_users_post_still_cannot_be_deleted(self):
        response = self.client_api.delete(f"/api/community/posts/{self.post.id}/")

        self.assertEqual(response.status_code, 403, response.content[:400])
        self.assertTrue(
            type(self.post).objects.filter(pk=self.post.pk).exists(),
            "a post was deleted by someone who did not write it",
        )


class GroupMembershipCountTests(TestCase):
    """The member count in a join or leave response.

    GroupViewSet prefetches `members`, and `Group.member_count` is
    `self.members.count()`, which answers from that prefetch cache. The group
    instance was serialized with the roster from before the request changed it,
    so joining answered with the count from before you joined.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", email="owner@example.com", password="pw"
        )
        self.joiner = User.objects.create_user(
            username="joiner", email="joiner@example.com", password="pw"
        )
        self.group = Group.objects.create(
            name="Algorithms", description="Weekly problems", owner=self.owner, type="public"
        )
        GroupMembership.objects.create(user=self.owner, group=self.group, role="owner")
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.joiner)

    def test_join_reports_the_count_including_you(self):
        response = self.client_api.post(f"/api/community/groups/{self.group.id}/join/")

        self.assertEqual(response.status_code, 200, response.content[:400])
        body = response.json()
        self.assertTrue(body["is_joined"])
        self.assertEqual(body["member_count"], 2, "the count predates the join")
        self.assertEqual(self.group.member_count, 2)

    def test_leave_reports_the_count_without_you(self):
        self.client_api.post(f"/api/community/groups/{self.group.id}/join/")

        response = self.client_api.post(f"/api/community/groups/{self.group.id}/leave/")

        self.assertEqual(response.status_code, 200, response.content[:400])
        body = response.json()
        self.assertFalse(body["is_joined"])
        self.assertEqual(body["member_count"], 1, "the count predates the leave")
        self.assertEqual(self.group.member_count, 1)


class ForumPostCreateTests(TestCase):
    """Creating a post from the community page.

    ForumPostCreateSerializer declares a write-only `forum_id`, and the create
    modal sent `forum`, so every attempt answered 400 and no post was ever
    created from the UI. Nothing caught it because the client typed the payload
    as Partial<ForumPost>, which is the read shape and nests the whole forum.
    """

    def setUp(self):
        from .models import Forum

        self.user = User.objects.create_user(
            username="poster", email="poster@example.com", password="pw"
        )
        self.forum = Forum.objects.create(title="General", description="general talk")
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)

    def test_a_post_is_created_from_forum_id(self):
        response = self.client_api.post(
            "/api/community/posts/",
            {
                "forum_id": str(self.forum.id),
                "title": "Which electives",
                "content": "A body long enough to pass the validator.",
                "tags": ["electives"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content[:400])

    def test_the_response_carries_the_id_and_author(self):
        """The client needs both to open, like or edit what it just created."""
        response = self.client_api.post(
            "/api/community/posts/",
            {
                "forum_id": str(self.forum.id),
                "title": "Which electives",
                "content": "A body long enough to pass the validator.",
            },
            format="json",
        )

        body = response.json()
        self.assertIn("id", body)
        self.assertEqual(body["author"]["username"], "poster")
        self.assertEqual(body["forum"]["id"], str(self.forum.id))

    def test_forum_is_not_accepted_in_place_of_forum_id(self):
        """Pins the contract the modal now sends, so it cannot drift back."""
        response = self.client_api.post(
            "/api/community/posts/",
            {
                "forum": str(self.forum.id),
                "title": "Which electives",
                "content": "A body long enough to pass the validator.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.content[:400])
        self.assertIn("forum_id", response.json())
