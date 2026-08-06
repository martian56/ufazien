from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import AITask, AIToolType, TaskStatus
from .tasks import TaskManager

User = get_user_model()


class ProcessTextTests(APITestCase):
    """What happens when the AI provider is unreachable.

    CELERY_TASK_ALWAYS_EAGER is on, so the work runs inside the request. It
    used to run inside the creating transaction too: a provider outage raised
    there, rolled the task row back with it, and the caller got a bare 500
    saying "Failed to create task" when the task was the one thing that had
    not failed.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="aiuser", email="ai@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def _process(self, tool_type="summarizer", text="Some text worth summarising."):
        # Processing is queued with transaction.on_commit, and TestCase wraps
        # each test in a transaction that never commits, so the callback has to
        # be run explicitly or the task would sit at "pending" forever here.
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                "/api/ai-tools/process/",
                {"tool_type": tool_type, "input_text": text},
                format="json",
            )

    @patch("ai_tools.tasks.AIService")
    def test_a_provider_outage_still_leaves_a_task_to_read(self, ai_service):
        ai_service.return_value.process_task.side_effect = RuntimeError("provider down")

        response = self._process()

        # The job was accepted; it is the processing that failed.
        self.assertEqual(response.status_code, 201, response.content[:300])
        task_id = response.json()["task_id"]

        task = AITask.objects.get(id=task_id)
        self.assertEqual(task.status, TaskStatus.FAILED)
        # The row keeps the real cause, for whoever has to fix it.
        self.assertIn("provider down", task.error_message)

    @patch("ai_tools.tasks.AIService")
    def test_the_client_can_poll_a_failed_task_for_the_reason(self, ai_service):
        ai_service.return_value.process_task.side_effect = RuntimeError("provider down")

        task_id = self._process().json()["task_id"]

        status_response = self.client.get(f"/api/ai-tools/tasks/{task_id}/status/")
        self.assertEqual(status_response.status_code, 200)
        body = status_response.json()
        self.assertEqual(body["status"], TaskStatus.FAILED)
        # ...but the person who submitted it gets something they can act on,
        # not the provider's own wording about subscription keys.
        self.assertEqual(body["error_message"], TaskManager.USER_FACING_FAILURE)
        self.assertNotIn("provider down", body["error_message"])

    @patch("ai_tools.tasks.AIService")
    def test_a_successful_run_returns_its_output(self, ai_service):
        ai_service.return_value.process_task.return_value = "A short summary."

        task_id = self._process().json()["task_id"]

        task = AITask.objects.get(id=task_id)
        self.assertEqual(task.status, TaskStatus.COMPLETED)
        self.assertEqual(task.output_text, "A short summary.")

    @patch("ai_tools.tasks.AIService")
    def test_every_tool_type_reaches_its_own_service_call(self, ai_service):
        """All four were implemented; only the humanizer had a page until #79."""
        ai_service.return_value.process_task.return_value = "done"

        for tool_type in [
            AIToolType.HUMANIZER,
            AIToolType.PARAPHRASER,
            AIToolType.SUMMARIZER,
            AIToolType.GRAMMAR_CHECKER,
        ]:
            response = self._process(tool_type=tool_type)
            self.assertEqual(response.status_code, 201, f"{tool_type}: {response.content[:200]}")
            task = AITask.objects.get(id=response.json()["task_id"])
            self.assertEqual(task.tool_type, tool_type)
            self.assertEqual(task.status, TaskStatus.COMPLETED)

    def test_an_unknown_tool_type_is_refused(self):
        response = self._process(tool_type="not-a-tool")
        self.assertEqual(response.status_code, 400)

    def test_empty_input_is_refused(self):
        response = self._process(text="   ")
        self.assertEqual(response.status_code, 400)

    def test_processing_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self._process().status_code, 401)

    @patch("ai_tools.tasks.AIService")
    def test_a_task_belongs_to_its_owner(self, ai_service):
        ai_service.return_value.process_task.return_value = "done"
        task_id = self._process().json()["task_id"]

        other = User.objects.create_user(
            username="aiother", email="aiother@example.com", password="pw"
        )
        self.client.force_authenticate(user=other)
        response = self.client.get(f"/api/ai-tools/tasks/{task_id}/status/")
        self.assertIn(response.status_code, (403, 404))

    @patch("ai_tools.tasks.AIService")
    def test_a_cached_result_is_not_served_to_another_user(self, ai_service):
        """The cache used to be read before ownership was checked.

        A completed task's output is cached for an hour under its id, and the
        view returned that cache entry before it ever looked at who was
        asking. Anyone with a task id could read someone else's finished text.
        """
        ai_service.return_value.process_task.return_value = "Private working draft."
        task_id = self._process().json()["task_id"]

        # Warm the cache as its owner.
        owner_view = self.client.get(f"/api/ai-tools/tasks/{task_id}/status/")
        self.assertEqual(owner_view.json()["output_text"], "Private working draft.")

        other = User.objects.create_user(
            username="aisnoop", email="aisnoop@example.com", password="pw"
        )
        self.client.force_authenticate(user=other)
        response = self.client.get(f"/api/ai-tools/tasks/{task_id}/status/")

        self.assertEqual(response.status_code, 404)
        self.assertNotIn("Private working draft.", response.content.decode())
