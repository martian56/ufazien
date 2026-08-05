from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
import tempfile
import os

from .security import rate_limiter
from .models import (
    Category, Tag, BlogPost, Comment, BlogPostBookmark, 
    BlogPostLike, BlogPostView, CommentLike
)

User = get_user_model()

class CategoryModelTest(TestCase):
    """Test cases for Category model"""
    
    def setUp(self):
        self.category = Category.objects.create(name="Technology")
    
    def test_category_creation(self):
        """Test category is created correctly"""
        self.assertEqual(self.category.name, "Technology")
        self.assertEqual(str(self.category), "Technology")
    
    def test_category_unique_name(self):
        """Test category name must be unique"""
        with self.assertRaises(Exception):
            Category.objects.create(name="Technology")
    
    def test_category_max_length(self):
        """Test category name max length"""
        long_name = "a" * 101  # Over 100 characters
        category = Category(name=long_name)
        with self.assertRaises(ValidationError):
            category.full_clean()

class TagModelTest(TestCase):
    """Test cases for Tag model"""
    
    def setUp(self):
        self.tag = Tag.objects.create(name="python")
    
    def test_tag_creation(self):
        """Test tag is created correctly"""
        self.assertEqual(self.tag.name, "python")
        self.assertEqual(str(self.tag), "python")
    
    def test_tag_unique_name(self):
        """Test tag name must be unique"""
        with self.assertRaises(Exception):
            Tag.objects.create(name="python")
    
    def test_tag_max_length(self):
        """Test tag name max length"""
        long_name = "a" * 51  # Over 50 characters
        tag = Tag(name=long_name)
        with self.assertRaises(ValidationError):
            tag.full_clean()

class BlogPostModelTest(TestCase):
    """Test cases for BlogPost model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.category = Category.objects.create(name="Technology")
        self.tag1 = Tag.objects.create(name="python")
        self.tag2 = Tag.objects.create(name="django")
        
        self.blog_post = BlogPost.objects.create(
            title="Test Blog Post",
            content="<p>This is test content</p>",
            excerpt="Test excerpt",
            author=self.user,
            category=self.category,
            read_time="5 min"
        )
        self.blog_post.tags.add(self.tag1, self.tag2)
    
    def test_blog_post_creation(self):
        """Test blog post is created correctly"""
        self.assertEqual(self.blog_post.title, "Test Blog Post")
        self.assertEqual(self.blog_post.content, "<p>This is test content</p>")
        self.assertEqual(self.blog_post.author, self.user)
        self.assertEqual(self.blog_post.category, self.category)
        self.assertEqual(self.blog_post.views, 0)
        self.assertTrue(self.blog_post.is_published)
        self.assertFalse(self.blog_post.is_featured)
    
    def test_blog_post_str_method(self):
        """Test blog post string representation"""
        self.assertEqual(str(self.blog_post), "Test Blog Post")
    
    def test_blog_post_tags_relationship(self):
        """Test many-to-many relationship with tags"""
        self.assertEqual(self.blog_post.tags.count(), 2)
        self.assertIn(self.tag1, self.blog_post.tags.all())
        self.assertIn(self.tag2, self.blog_post.tags.all())
    
    def test_blog_post_ordering(self):
        """Test blog posts are ordered by published_at desc"""
        from django.utils import timezone
        from datetime import timedelta
        
        # Create an older post with an earlier timestamp
        older_time = timezone.now() - timedelta(hours=1)
        older_post = BlogPost.objects.create(
            title="Older Post",
            content="Older content",
            author=self.user,
            read_time="3 min"
        )
        # Manually set the published_at to be older
        BlogPost.objects.filter(id=older_post.id).update(published_at=older_time)
        
        posts = BlogPost.objects.all()
        self.assertEqual(posts.first(), self.blog_post)  # Newer post first
    
    def test_blog_post_featured_image_upload(self):
        """Test featured image upload"""
        # Create a simple test image
        image_content = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x00\x00\x00\x21\xf9\x04\x01\x0a\x00\x01\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x4c\x01\x00\x3b'
        uploaded_file = SimpleUploadedFile(
            name='test_image.gif',
            content=image_content,
            content_type='image/gif'
        )
        
        blog_post = BlogPost.objects.create(
            title="Post with Image",
            content="Content",
            author=self.user,
            featured_image=uploaded_file,
            read_time="2 min"
        )
        
        self.assertIsNotNone(blog_post.featured_image)
        
        # Clean up
        if blog_post.featured_image:
            blog_post.featured_image.delete()

class CommentModelTest(TestCase):
    """Test cases for Comment model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.blog_post = BlogPost.objects.create(
            title="Test Post",
            content="Test content",
            author=self.user,
            read_time="5 min"
        )
        self.comment = Comment.objects.create(
            post=self.blog_post,
            author=self.user,
            content="This is a test comment"
        )
    
    def test_comment_creation(self):
        """Test comment is created correctly"""
        self.assertEqual(self.comment.post, self.blog_post)
        self.assertEqual(self.comment.author, self.user)
        self.assertEqual(self.comment.content, "This is a test comment")
        self.assertIsNone(self.comment.parent)
    
    def test_comment_str_method(self):
        """Test comment string representation"""
        expected_str = f'Comment by {self.user} on {self.blog_post}'
        self.assertEqual(str(self.comment), expected_str)
    
    def test_comment_reply(self):
        """Test comment reply functionality"""
        reply = Comment.objects.create(
            post=self.blog_post,
            author=self.user,
            content="This is a reply",
            parent=self.comment
        )
        
        self.assertEqual(reply.parent, self.comment)
        self.assertIn(reply, self.comment.replies.all())

class BlogPostLikeModelTest(TestCase):
    """Test cases for BlogPostLike model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.blog_post = BlogPost.objects.create(
            title="Test Post",
            content="Test content",
            author=self.user,
            read_time="5 min"
        )
    
    def test_blog_post_like_creation(self):
        """Test blog post like is created correctly"""
        like = BlogPostLike.objects.create(user=self.user, post=self.blog_post)
        self.assertEqual(like.user, self.user)
        self.assertEqual(like.post, self.blog_post)
    
    def test_blog_post_like_unique_constraint(self):
        """Test user can only like a post once"""
        BlogPostLike.objects.create(user=self.user, post=self.blog_post)
        with self.assertRaises(Exception):
            BlogPostLike.objects.create(user=self.user, post=self.blog_post)

class BlogPostBookmarkModelTest(TestCase):
    """Test cases for BlogPostBookmark model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.blog_post = BlogPost.objects.create(
            title="Test Post",
            content="Test content",
            author=self.user,
            read_time="5 min"
        )
    
    def test_blog_post_bookmark_creation(self):
        """Test blog post bookmark is created correctly"""
        bookmark = BlogPostBookmark.objects.create(user=self.user, post=self.blog_post)
        self.assertEqual(bookmark.user, self.user)
        self.assertEqual(bookmark.post, self.blog_post)
    
    def test_blog_post_bookmark_unique_constraint(self):
        """Test user can only bookmark a post once"""
        BlogPostBookmark.objects.create(user=self.user, post=self.blog_post)
        with self.assertRaises(Exception):
            BlogPostBookmark.objects.create(user=self.user, post=self.blog_post)

class BlogPostViewModelTest(TestCase):
    """Test cases for BlogPostView model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.blog_post = BlogPost.objects.create(
            title="Test Post",
            content="Test content",
            author=self.user,
            read_time="5 min"
        )
    
    def test_blog_post_view_creation(self):
        """Test blog post view is created correctly"""
        view = BlogPostView.objects.create(user=self.user, post=self.blog_post)
        self.assertEqual(view.user, self.user)
        self.assertEqual(view.post, self.blog_post)
        self.assertIsNotNone(view.viewed_at)
    
    def test_blog_post_view_unique_constraint(self):
        """Test user can only have one view record per post"""
        BlogPostView.objects.create(user=self.user, post=self.blog_post)
        with self.assertRaises(Exception):
            BlogPostView.objects.create(user=self.user, post=self.blog_post)

class CommentLikeModelTest(TestCase):
    """Test cases for CommentLike model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.blog_post = BlogPost.objects.create(
            title="Test Post",
            content="Test content",
            author=self.user,
            read_time="5 min"
        )
        self.comment = Comment.objects.create(
            post=self.blog_post,
            author=self.user,
            content="Test comment"
        )
    
    def test_comment_like_creation(self):
        """Test comment like is created correctly"""
        like = CommentLike.objects.create(user=self.user, comment=self.comment)
        self.assertEqual(like.user, self.user)
        self.assertEqual(like.comment, self.comment)
    
    def test_comment_like_unique_constraint(self):
        """Test user can only like a comment once"""
        CommentLike.objects.create(user=self.user, comment=self.comment)
        with self.assertRaises(Exception):
            CommentLike.objects.create(user=self.user, comment=self.comment)


# API Tests
class BlogPostAPITest(APITestCase):
    """Test cases for Blog Post API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.category = Category.objects.create(name="Technology")
        self.tag = Tag.objects.create(name="python")
        
        self.blog_post = BlogPost.objects.create(
            title="Test Post",
            content="<p>Test content</p>",
            excerpt="Test excerpt",
            author=self.user,
            category=self.category,
            read_time="5 min"
        )
        self.blog_post.tags.add(self.tag)
    
    def test_get_blog_posts_authenticated(self):
        """Test getting blog posts when authenticated"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/blog/posts/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], "Test Post")
    
    def test_get_blog_posts_unauthenticated(self):
        """Test getting blog posts when not authenticated"""
        response = self.client.get('/api/blog/posts/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_create_blog_post(self):
        """Test creating a new blog post"""
        self.client.force_authenticate(user=self.user)
        data = {
            'title': 'New Test Post',
            'content': '<p>New test content</p>',
            'excerpt': 'New test excerpt',
            'category': self.category.id,
            'tag_names': ['python', 'django'],
            'read_time': '3 min'
        }
        
        response = self.client.post('/api/blog/posts/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BlogPost.objects.count(), 2)
        
        new_post = BlogPost.objects.get(title='New Test Post')
        self.assertEqual(new_post.author, self.user)
        self.assertEqual(new_post.content, '<p>New test content</p>')

class CategoryAPITest(APITestCase):
    """Test cases for Category API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.category = Category.objects.create(name="Technology")
    
    def test_get_categories_authenticated(self):
        """Test getting categories when authenticated"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/blog/categories/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if our category is in the response
        category_names = [cat['name'] for cat in response.data['results']]
        self.assertIn("Technology", category_names)
    
    def test_get_categories_unauthenticated(self):
        """Test getting categories when not authenticated"""
        response = self.client.get('/api/blog/categories/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

class TagAPITest(APITestCase):
    """Test cases for Tag API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.tag = Tag.objects.create(name="python")
    
    def test_get_tags_authenticated(self):
        """Test getting tags when authenticated"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/blog/tags/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if our tag is in the response
        tag_names = [tag['name'] for tag in response.data['results']]
        self.assertIn("python", tag_names)
    
    def test_get_tags_unauthenticated(self):
        """Test getting tags when not authenticated"""
        response = self.client.get('/api/blog/tags/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class DraftVisibilityTests(APITestCase):
    """An unpublished post is a draft and belongs only to its author.

    The list and detail views never filtered on is_published, so a draft was
    served to every authenticated user exactly like a published post. That
    makes "save as draft" impossible: saving published it.
    """

    def setUp(self):
        self.author = User.objects.create_user(
            username="writer", email="writer@example.com", password="pw"
        )
        self.reader = User.objects.create_user(
            username="reader", email="reader@example.com", password="pw"
        )
        self.category = Category.objects.create(name="Tech")

        self.published = BlogPost.objects.create(
            title="A published post",
            content="<p>Public</p>",
            author=self.author,
            category=self.category,
            read_time="1 min",
            is_published=True,
        )
        self.draft = BlogPost.objects.create(
            title="An unfinished draft",
            content="<p>Half written</p>",
            author=self.author,
            category=self.category,
            read_time="1 min",
            is_published=False,
        )
        self.client = APIClient()

    def _titles(self, response):
        body = response.json()
        items = body["results"] if isinstance(body, dict) and "results" in body else body
        return [item["title"] for item in items]

    def test_another_user_does_not_see_a_draft_in_the_list(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.get("/api/blog/posts/")
        self.assertEqual(response.status_code, 200, response.content[:300])
        self.assertIn("A published post", self._titles(response))
        self.assertNotIn("An unfinished draft", self._titles(response))

    def test_another_user_cannot_open_a_draft(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.get(f"/api/blog/posts/{self.draft.id}/")
        self.assertEqual(response.status_code, 404, response.content[:300])

    def test_the_author_sees_their_own_draft_in_the_list(self):
        self.client.force_authenticate(user=self.author)
        response = self.client.get("/api/blog/posts/")
        self.assertIn("An unfinished draft", self._titles(response))

    def test_the_author_can_open_their_own_draft(self):
        self.client.force_authenticate(user=self.author)
        response = self.client.get(f"/api/blog/posts/{self.draft.id}/")
        self.assertEqual(response.status_code, 200, response.content[:300])

    def test_drafts_only_returns_the_users_own_unpublished_posts(self):
        BlogPost.objects.create(
            title="Someone else's draft",
            content="<p>x</p>",
            author=self.reader,
            category=self.category,
            read_time="1 min",
            is_published=False,
        )
        self.client.force_authenticate(user=self.author)
        response = self.client.get("/api/blog/posts/?status=draft")
        titles = self._titles(response)
        self.assertIn("An unfinished draft", titles)
        self.assertNotIn("Someone else's draft", titles)
        self.assertNotIn("A published post", titles)


class PublishDateTests(TestCase):
    """published_at should mean published, not created.

    It was auto_now_add, so it recorded creation. A draft written on Monday and
    published on Friday claimed Monday, and the feed ordered by it put a
    freshly published post wherever it happened to have been started.
    """

    def setUp(self):
        self.author = User.objects.create_user(
            username="dater", email="dater@example.com", password="pw"
        )
        self.category = Category.objects.create(name="Tech")

    def _post(self, title, published):
        return BlogPost.objects.create(
            title=title,
            content="<p>x</p>",
            author=self.author,
            category=self.category,
            read_time="1 min",
            is_published=published,
        )

    def test_a_draft_has_no_publication_date(self):
        draft = self._post("Draft", published=False)
        self.assertIsNone(draft.published_at)
        self.assertIsNotNone(draft.created_at)

    def test_publishing_stamps_the_date(self):
        draft = self._post("Draft", published=False)
        draft.is_published = True
        draft.save()
        draft.refresh_from_db()
        self.assertIsNotNone(draft.published_at)

    def test_the_publication_date_is_later_than_creation(self):
        draft = self._post("Draft", published=False)
        created = draft.created_at
        draft.is_published = True
        draft.save()
        draft.refresh_from_db()
        self.assertGreaterEqual(draft.published_at, created)

    def test_unpublishing_clears_the_date(self):
        post = self._post("Live", published=True)
        self.assertIsNotNone(post.published_at)
        post.is_published = False
        post.save()
        post.refresh_from_db()
        self.assertIsNone(post.published_at)

    def test_republishing_uses_a_fresh_date(self):
        post = self._post("Live", published=True)
        first = post.published_at

        post.is_published = False
        post.save()
        post.is_published = True
        post.save()
        post.refresh_from_db()

        self.assertIsNotNone(post.published_at)
        self.assertGreaterEqual(post.published_at, first)


class DraftSavingTests(APITestCase):
    """A draft is saved before the writing is finished.

    The serializer required a category and a read time, neither of which a
    writer has settled on at the first keystroke, so the very first save of an
    unfinished post was rejected.
    """

    def setUp(self):
        self.author = User.objects.create_user(
            username="drafter", email="drafter@example.com", password="pw"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.author)

    def test_a_draft_saves_without_a_category(self):
        response = self.client.post(
            "/api/blog/posts/",
            {"title": "Untitled draft", "content": "<p>Just started</p>", "is_published": False},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.content[:400])
        self.assertFalse(response.json()["is_published"])

    def test_a_draft_saves_without_a_read_time(self):
        response = self.client.post(
            "/api/blog/posts/",
            {"title": "No read time", "content": "<p>x</p>", "is_published": False},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.content[:400])

    def test_a_draft_can_be_updated_then_published(self):
        created = self.client.post(
            "/api/blog/posts/",
            {"title": "Work in progress", "content": "<p>a</p>", "is_published": False},
            format="json",
        )
        post_id = created.json()["id"]

        category = Category.objects.create(name="Tech")
        published = self.client.patch(
            f"/api/blog/posts/{post_id}/",
            {"content": "<p>finished</p>", "category": category.id, "is_published": True},
            format="json",
        )
        self.assertEqual(published.status_code, 200, published.content[:400])

        body = published.json()
        self.assertTrue(body["is_published"])
        self.assertIsNotNone(body["published_at"])

    def test_updating_a_draft_does_not_create_a_second_post(self):
        created = self.client.post(
            "/api/blog/posts/",
            {"title": "One post", "content": "<p>a</p>", "is_published": False},
            format="json",
        )
        post_id = created.json()["id"]

        self.client.patch(
            f"/api/blog/posts/{post_id}/", {"content": "<p>b</p>"}, format="json"
        )
        self.assertEqual(BlogPost.objects.filter(author=self.author).count(), 1)


class WritingStatsTests(APITestCase):
    """The editor's stats panel was fabricated; these guard the real numbers."""

    def setUp(self):
        self.author = User.objects.create_user(username="statsauthor", password="pw")
        self.other = User.objects.create_user(username="otherauthor", password="pw")
        self.client.force_authenticate(user=self.author)

    def _post_on(self, day, author=None, published=True):
        post = BlogPost.objects.create(
            title="p",
            content="<p>x</p>",
            author=author or self.author,
            read_time="1",
            is_published=published,
        )
        # created_at is auto_now_add, so it has to be set after the fact.
        BlogPost.objects.filter(pk=post.pk).update(created_at=day)
        return post

    def test_streak_counts_back_from_today(self):
        now = timezone.now()
        for days_ago in (0, 1, 2):
            self._post_on(now - timedelta(days=days_ago))
        # A gap, then an older run that must not be counted.
        self._post_on(now - timedelta(days=5))

        body = self.client.get("/api/blog/my-stats/").json()
        self.assertEqual(body["streak_days"], 3)

    def test_streak_survives_a_day_with_no_post_yet(self):
        """Yesterday and before still counts until today has passed."""
        now = timezone.now()
        self._post_on(now - timedelta(days=1))
        self._post_on(now - timedelta(days=2))

        body = self.client.get("/api/blog/my-stats/").json()
        self.assertEqual(body["streak_days"], 2)

    def test_streak_is_zero_when_the_last_post_is_old(self):
        self._post_on(timezone.now() - timedelta(days=3))
        body = self.client.get("/api/blog/my-stats/").json()
        self.assertEqual(body["streak_days"], 0)

    def test_two_posts_on_one_day_count_as_one_day(self):
        now = timezone.now()
        self._post_on(now)
        self._post_on(now)
        body = self.client.get("/api/blog/my-stats/").json()
        self.assertEqual(body["streak_days"], 1)
        self.assertEqual(body["posts_this_week"], 1)

    def test_another_author_posts_are_not_counted(self):
        self._post_on(timezone.now(), author=self.other)
        body = self.client.get("/api/blog/my-stats/").json()
        self.assertEqual(body["streak_days"], 0)
        self.assertEqual(body["published"], 0)

    def test_published_and_drafts_are_counted_separately(self):
        now = timezone.now()
        self._post_on(now, published=True)
        self._post_on(now, published=False)
        body = self.client.get("/api/blog/my-stats/").json()
        self.assertEqual(body["published"], 1)
        self.assertEqual(body["drafts"], 1)

    def test_best_hour_needs_enough_posts_to_mean_anything(self):
        now = timezone.now()
        self._post_on(now)
        self.assertIsNone(self.client.get("/api/blog/my-stats/").json()["best_hour"])

        self._post_on(now - timedelta(days=1))
        self._post_on(now - timedelta(days=2))
        self.assertIsNotNone(self.client.get("/api/blog/my-stats/").json()["best_hour"])

    def test_stats_require_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/blog/my-stats/").status_code, 401)


class PostVisibilityTests(APITestCase):
    """The editor offered Public/Unlisted/Private/Friends and sent none of it.

    Choosing "Private" published to everyone. These pin down who can actually
    reach a post now that the choice is enforced server-side.
    """

    def setUp(self):
        # The post rate limiter is a module-level dict, so its counts survive
        # from one test to the next and the sixth post in a class 429s.
        rate_limiter.requests.clear()
        self.author = User.objects.create_user(username="vauthor", password="pw")
        self.stranger = User.objects.create_user(username="vstranger", password="pw")
        self.follower = User.objects.create_user(username="vfollower", password="pw")
        self.author.followers.add(self.follower)

    def _post(self, visibility, published_at=None):
        post = BlogPost.objects.create(
            title="t",
            content="<p>c</p>",
            author=self.author,
            read_time="1",
            is_published=True,
            visibility=visibility,
        )
        if published_at:
            BlogPost.objects.filter(pk=post.pk).update(published_at=published_at)
        return post

    def _list_ids(self, user):
        self.client.force_authenticate(user=user)
        body = self.client.get("/api/blog/posts/").json()
        return {p["id"] for p in body["results"]}

    def _detail_status(self, user, post):
        self.client.force_authenticate(user=user)
        return self.client.get(f"/api/blog/posts/{post.id}/").status_code

    def test_private_post_is_invisible_to_everyone_but_its_author(self):
        post = self._post(BlogPost.Visibility.PRIVATE)
        self.assertNotIn(post.id, self._list_ids(self.stranger))
        self.assertEqual(self._detail_status(self.stranger, post), 404)
        self.assertIn(post.id, self._list_ids(self.author))
        self.assertEqual(self._detail_status(self.author, post), 200)

    def test_unlisted_post_is_hidden_from_listings_but_opens_by_link(self):
        post = self._post(BlogPost.Visibility.UNLISTED)
        self.assertNotIn(post.id, self._list_ids(self.stranger))
        self.assertEqual(self._detail_status(self.stranger, post), 200)

    def test_followers_only_post_reaches_followers_and_no_one_else(self):
        post = self._post(BlogPost.Visibility.FOLLOWERS)
        self.assertIn(post.id, self._list_ids(self.follower))
        self.assertEqual(self._detail_status(self.follower, post), 200)
        self.assertNotIn(post.id, self._list_ids(self.stranger))
        self.assertEqual(self._detail_status(self.stranger, post), 404)

    def test_public_post_reaches_everyone(self):
        post = self._post(BlogPost.Visibility.PUBLIC)
        self.assertIn(post.id, self._list_ids(self.stranger))
        self.assertEqual(self._detail_status(self.stranger, post), 200)

    def test_a_post_dated_in_the_future_is_not_live_yet(self):
        post = self._post(
            BlogPost.Visibility.PUBLIC, published_at=timezone.now() + timedelta(days=2)
        )
        self.assertNotIn(post.id, self._list_ids(self.stranger))
        self.assertEqual(self._detail_status(self.stranger, post), 404)
        # Its author can still see and finish it.
        self.assertIn(post.id, self._list_ids(self.author))
        self.assertEqual(self._detail_status(self.author, post), 200)

    def test_a_scheduled_post_becomes_visible_once_its_time_passes(self):
        post = self._post(
            BlogPost.Visibility.PUBLIC, published_at=timezone.now() + timedelta(minutes=5)
        )
        self.assertEqual(self._detail_status(self.stranger, post), 404)

        BlogPost.objects.filter(pk=post.pk).update(published_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self._detail_status(self.stranger, post), 200)
        self.assertIn(post.id, self._list_ids(self.stranger))

    def test_visibility_defaults_to_public_so_existing_posts_are_unaffected(self):
        post = BlogPost.objects.create(
            title="t", content="<p>c</p>", author=self.author, read_time="1"
        )
        self.assertEqual(post.visibility, BlogPost.Visibility.PUBLIC)
        self.assertIn(post.id, self._list_ids(self.stranger))

    def test_author_can_set_visibility_when_publishing(self):
        self.client.force_authenticate(user=self.author)
        category = Category.objects.create(name="Cat")
        created = self.client.post(
            "/api/blog/posts/",
            {
                "title": "Secret",
                "content": "<p>hidden</p>",
                "category": category.id,
                "visibility": "private",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content[:400])
        self.assertEqual(created.json()["visibility"], "private")
        self.assertNotIn(created.json()["id"], self._list_ids(self.stranger))

    def test_author_can_schedule_by_sending_a_future_published_at(self):
        self.client.force_authenticate(user=self.author)
        category = Category.objects.create(name="Cat2")
        when = timezone.now() + timedelta(days=1)
        created = self.client.post(
            "/api/blog/posts/",
            {
                "title": "Later",
                "content": "<p>soon</p>",
                "category": category.id,
                "published_at": when.isoformat(),
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content[:400])
        self.assertTrue(created.json()["is_scheduled"])
        self.assertNotIn(created.json()["id"], self._list_ids(self.stranger))

    def test_private_posts_stay_out_of_popular(self):
        post = self._post(BlogPost.Visibility.PRIVATE)
        self.client.force_authenticate(user=self.stranger)
        popular = self.client.get("/api/blog/posts/popular/").json()
        self.assertNotIn(post.id, {p["id"] for p in popular})

    def test_a_bookmarked_post_turned_private_stops_being_served(self):
        post = self._post(BlogPost.Visibility.PUBLIC)
        BlogPostBookmark.objects.create(user=self.stranger, post=post)
        self.client.force_authenticate(user=self.stranger)

        before = self.client.get("/api/blog/bookmarks/me/").json()
        self.assertIn(post.id, {p["id"] for p in before["results"]})

        BlogPost.objects.filter(pk=post.pk).update(visibility=BlogPost.Visibility.PRIVATE)
        after = self.client.get("/api/blog/bookmarks/me/").json()
        self.assertNotIn(post.id, {p["id"] for p in after["results"]})
