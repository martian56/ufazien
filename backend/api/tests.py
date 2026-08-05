from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from blog.models import BlogPost
from django.test import TestCase

# Create your tests here.


class PlatformStatsTests(APITestCase):
    """The landing page numbers were literals in the JSX."""

    def test_stats_are_public_so_a_signed_out_visitor_sees_them(self):
        response = self.client.get("/api/stats/")
        self.assertEqual(response.status_code, 200)

    def test_stats_count_real_rows(self):
        User = get_user_model()
        User.objects.create_user(username="statsa", email="a@example.com", password="pw")
        User.objects.create_user(username="statsb", email="b@example.com", password="pw")

        body = self.client.get("/api/stats/").json()
        self.assertEqual(body["students"], 2)
        self.assertEqual(body["blog_posts"], 0)

    def test_private_posts_are_not_counted_in_the_public_total(self):
        author = get_user_model().objects.create_user(
            username="statsauthor2", email="c@example.com", password="pw"
        )
        BlogPost.objects.create(
            title="public", content="x", author=author, read_time="1", is_published=True
        )
        BlogPost.objects.create(
            title="private",
            content="x",
            author=author,
            read_time="1",
            is_published=True,
            visibility=BlogPost.Visibility.PRIVATE,
        )

        self.assertEqual(self.client.get("/api/stats/").json()["blog_posts"], 1)

    def test_stats_expose_no_one_in_particular(self):
        """Aggregate counts only: no names, no addresses, no ids."""
        get_user_model().objects.create_user(
            username="statsprivate", email="secret@example.com", password="pw"
        )
        raw = self.client.get("/api/stats/").content.decode()
        self.assertNotIn("secret@example.com", raw)
        self.assertNotIn("statsprivate", raw)
