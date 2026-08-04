from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import CalendarEvent

User = get_user_model()

EVENTS_URL = "/api/calendar/events/"


class CalendarEventTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            username="alice", email="alice@example.com", password="pw"
        )
        self.bob = User.objects.create_user(
            username="bob", email="bob@example.com", password="pw"
        )
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.alice)

    @staticmethod
    def _items(response):
        """List responses are unpaginated here; tolerate either shape."""
        body = response.json()
        return body["results"] if isinstance(body, dict) else body

    def _payload(self, **overrides):
        payload = {
            "title": "Database Systems Lecture",
            "description": "Query optimization",
            "date": "2026-03-02",
            "start_time": "09:00",
            "end_time": "10:30",
            "location": "Room A-201",
            "category": "class",
            "priority": "high",
            "course_code": "CS301",
            "recurring": "weekly",
        }
        payload.update(overrides)
        return payload

    def test_requires_authentication(self):
        response = APIClient().get(EVENTS_URL)
        self.assertIn(response.status_code, (401, 403))

    def test_create_returns_id_and_persists(self):
        response = self.client_api.post(EVENTS_URL, self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.content[:400])
        self.assertIn("id", response.json())
        self.assertEqual(CalendarEvent.objects.count(), 1)
        self.assertEqual(CalendarEvent.objects.first().user, self.alice)

    def test_color_defaults_from_category(self):
        response = self.client_api.post(
            EVENTS_URL, self._payload(category="assignment"), format="json"
        )
        self.assertEqual(response.json()["color"], "bg-red-500")

    def test_camelcase_field_names_accepted(self):
        payload = self._payload()
        payload.pop("start_time")
        payload.pop("end_time")
        payload.pop("course_code")
        payload.update({"startTime": "11:00", "endTime": "12:00", "courseCode": "CS205"})

        response = self.client_api.post(EVENTS_URL, payload, format="json")
        self.assertEqual(response.status_code, 201, response.content[:400])
        event = CalendarEvent.objects.get()
        self.assertEqual(event.start_time.strftime("%H:%M"), "11:00")
        self.assertEqual(event.course_code, "CS205")

    def test_end_before_start_is_rejected(self):
        response = self.client_api.post(
            EVENTS_URL,
            self._payload(start_time="15:00", end_time="14:00"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_time", response.json())

    def test_update_and_delete(self):
        created = self.client_api.post(EVENTS_URL, self._payload(), format="json").json()
        detail = f"{EVENTS_URL}{created['id']}/"

        patched = self.client_api.patch(detail, {"title": "Renamed"}, format="json")
        self.assertEqual(patched.status_code, 200, patched.content[:300])
        self.assertEqual(patched.json()["title"], "Renamed")

        deleted = self.client_api.delete(detail)
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(CalendarEvent.objects.count(), 0)

    def test_one_user_cannot_see_anothers_events(self):
        CalendarEvent.objects.create(
            user=self.bob, title="Bob private", date="2026-03-02",
            start_time="09:00", end_time="10:00",
        )
        response = self.client_api.get(EVENTS_URL)
        self.assertEqual(response.status_code, 200)
        titles = [e["title"] for e in self._items(response)]
        self.assertNotIn("Bob private", titles)

    def test_one_user_cannot_read_or_delete_anothers_event(self):
        bobs = CalendarEvent.objects.create(
            user=self.bob, title="Bob private", date="2026-03-02",
            start_time="09:00", end_time="10:00",
        )
        detail = f"{EVENTS_URL}{bobs.id}/"
        self.assertEqual(self.client_api.get(detail).status_code, 404)
        self.assertEqual(self.client_api.delete(detail).status_code, 404)
        self.assertEqual(CalendarEvent.objects.filter(pk=bobs.pk).count(), 1)

    def test_date_range_filter(self):
        for day in ("2026-03-01", "2026-03-10", "2026-03-20"):
            CalendarEvent.objects.create(
                user=self.alice, title=f"E{day}", date=day,
                start_time="09:00", end_time="10:00",
            )
        response = self.client_api.get(
            EVENTS_URL, {"start": "2026-03-05", "end": "2026-03-15"}
        )
        titles = [e["title"] for e in self._items(response)]
        self.assertEqual(titles, ["E2026-03-10"])
