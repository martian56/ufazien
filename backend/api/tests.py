from rest_framework.test import APITestCase, APIClient
from django.contrib.auth import get_user_model
from blog.models import BlogPost
from django.test import TestCase

User = get_user_model()

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


class SearchPermissionTests(TestCase):
    """Search must never surface something the caller cannot already reach."""

    def setUp(self):
        from blog.models import BlogPost
        from schedule.models import CalendarEvent

        self.alice = User.objects.create_user(
            username="alicesearch", email="alicesearch@example.com", password="pw"
        )
        self.bob = User.objects.create_user(
            username="bobsearch", email="bobsearch@example.com", password="pw"
        )

        BlogPost.objects.create(
            author=self.alice,
            title="Quantum notes public",
            content="body",
            is_published=True,
            visibility=BlogPost.Visibility.PUBLIC,
        )
        BlogPost.objects.create(
            author=self.alice,
            title="Quantum notes private",
            content="body",
            is_published=True,
            visibility=BlogPost.Visibility.PRIVATE,
        )
        CalendarEvent.objects.create(
            user=self.alice,
            title="Quantum exam",
            date="2026-09-01",
            start_time="10:00",
            end_time="11:00",
        )

        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.bob)

    def _titles(self, q="Quantum"):
        response = self.client_api.get("/api/search/", {"q": q})
        self.assertEqual(response.status_code, 200, response.content[:300])
        return [r["title"] for r in response.json()["results"]]

    def test_a_public_post_is_found(self):
        self.assertIn("Quantum notes public", self._titles())

    def test_another_users_private_post_is_not_found(self):
        self.assertNotIn("Quantum notes private", self._titles())

    def test_another_users_calendar_event_is_not_found(self):
        self.assertNotIn("Quantum exam", self._titles())

    def test_the_owner_finds_their_own_calendar_event(self):
        self.client_api.force_authenticate(user=self.alice)
        self.assertIn("Quantum exam", self._titles())

    def test_no_result_ever_carries_an_email_address(self):
        response = self.client_api.get("/api/search/", {"q": "search"})
        body = response.content.decode()
        self.assertNotIn("alicesearch@example.com", body)
        self.assertNotIn("@example.com", body)

    def test_a_short_query_returns_nothing(self):
        response = self.client_api.get("/api/search/", {"q": "a"})
        self.assertEqual(response.json()["results"], [])

    def test_search_requires_authentication(self):
        anon = APIClient()
        response = anon.get("/api/search/", {"q": "Quantum"})
        self.assertIn(response.status_code, (401, 403))


class PlatformStatsTests(TestCase):
    """
    The figures on the landing page.

    They were literals in the JSX once. Now they come from here, and the page
    shows every one of them — it used to fetch seven and render four.
    """

    def test_it_is_public(self):
        """The landing page is, so the counts behind it have to be."""
        from rest_framework.test import APIClient

        response = APIClient().get('/api/stats/')

        self.assertEqual(response.status_code, 200)

    def test_it_counts_the_whole_platform(self):
        from rest_framework.test import APIClient

        body = APIClient().get('/api/stats/').json()

        for name in (
            'students', 'gpa_calculations', 'average_calculations',
            'average_schemas', 'hosted_websites', 'blog_posts', 'study_groups',
            'forum_posts', 'hosted_databases', 'deployments',
            'campus_lobbies', 'ai_tasks', 'calendar_events',
        ):
            self.assertIn(name, body, f'the landing page has no figure for {name}')
            self.assertIsInstance(body[name], int)

    def test_every_figure_is_a_count_and_nothing_else(self):
        """
        Served to a signed-out visitor, so nothing here may identify anybody:
        no names, no emails, no ids — thirteen whole numbers.
        """
        from rest_framework.test import APIClient

        body = APIClient().get('/api/stats/').json()

        self.assertTrue(all(isinstance(value, int) for value in body.values()), body)

    def test_the_counts_are_real(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from game.models import Lobby

        User = get_user_model()
        host = User.objects.create_user(username='counted', email='c@e.com', password='pw')
        Lobby.objects.create(name='One', host=host)
        Lobby.objects.create(name='Two', host=host)

        from api.views import PlatformStatsView

        # Read past the cache, which exists so a landing page does not run a
        # dozen COUNTs per visitor.
        counted = PlatformStatsView.count()

        self.assertEqual(counted['campus_lobbies'], 2)
        self.assertGreaterEqual(counted['students'], 1)

    def test_it_is_cached_so_a_visitor_does_not_run_a_dozen_counts(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient

        cache.delete('platform-stats')
        client = APIClient()
        client.get('/api/stats/')

        self.assertIsNotNone(cache.get('platform-stats'))
