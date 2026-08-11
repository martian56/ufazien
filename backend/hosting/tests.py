from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class PublicWebsiteListTests(TestCase):
    """
    The listing the campus screens read.

    It is unauthenticated and it describes other people's work, so what it
    leaves out matters as much as what it includes.
    """

    def setUp(self):
        from .models import Website

        self.named = User.objects.create_user(
            username="named", email="named@example.com", password="pw",
            first_name="Aysel", last_name="Mammadova",
        )
        self.nameless = User.objects.create_user(
            username="nameless", email="nameless@example.com", password="pw",
        )
        Website.objects.create(name="portfolio", user=self.named, status="active")
        Website.objects.create(name="notes", user=self.nameless, status="active")
        Website.objects.create(name="halfbuilt", user=self.named, status="building")
        self.api = APIClient()

    def _rows(self, response):
        body = response.json()
        return body["results"] if isinstance(body, dict) and "results" in body else body

    def test_a_user_with_no_name_is_credited_by_username(self):
        """
        first_name and last_name both default to the empty string, and the
        listing joined them unconditionally — so every account that never
        filled in a name was credited as `" "`, a single space. On a field
        whose whole purpose is to say who made the thing, that is worse than
        showing nothing at all.
        """
        response = self.api.get("/api/hosting/public/websites/")
        self.assertEqual(response.status_code, 200, response.content[:300])
        creators = {row["name"]: row["creator"] for row in self._rows(response)}
        self.assertEqual(creators["portfolio"], "Aysel Mammadova")
        self.assertEqual(creators["notes"], "nameless")
        self.assertNotEqual(creators["notes"].strip(), "")

    def test_no_email_reaches_the_listing(self):
        """
        The rule this codebase has bled for. A site listing is read by
        everybody; an address is not the owner's to give away because they
        published one.
        """
        response = self.api.get("/api/hosting/public/websites/")
        body = response.content.decode()
        self.assertNotIn("named@example.com", body)
        self.assertNotIn("nameless@example.com", body)

    def test_only_active_sites_are_listed(self):
        response = self.api.get("/api/hosting/public/websites/")
        names = {row["name"] for row in self._rows(response)}
        self.assertIn("portfolio", names)
        self.assertNotIn("halfbuilt", names)

    def test_the_listing_carries_an_address_to_visit(self):
        """A screen showing a site nobody can reach is a screen showing nothing."""
        response = self.api.get("/api/hosting/public/websites/")
        row = next(r for r in self._rows(response) if r["name"] == "portfolio")
        self.assertTrue(row["url"].startswith("https://"))

    def test_deployment_details_stay_out_of_it(self):
        """
        The owner's serializer carries the git repository, the build commands
        and the environment variables. None of that belongs in a public list.
        """
        response = self.api.get("/api/hosting/public/websites/")
        row = self._rows(response)[0]
        for field in ("environment_variables", "git_repository", "build_command"):
            self.assertNotIn(field, row)
