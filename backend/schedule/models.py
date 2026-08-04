import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class CalendarEvent(models.Model):
    """A single entry on a user's calendar."""

    CATEGORIES = [
        ('class', 'Class'),
        ('assignment', 'Assignment'),
        ('exam', 'Exam'),
        ('study', 'Study'),
        ('meeting', 'Meeting'),
        ('event', 'Event'),
        ('club', 'Club'),
        ('personal', 'Personal'),
    ]

    PRIORITIES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    RECURRING = [
        ('none', 'Does not repeat'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('biweekly', 'Every two weeks'),
        ('monthly', 'Monthly'),
    ]

    # Tailwind classes the UI already uses, keyed by category.
    CATEGORY_COLORS = {
        'class': 'bg-blue-500',
        'assignment': 'bg-red-500',
        'exam': 'bg-rose-600',
        'study': 'bg-green-500',
        'meeting': 'bg-orange-500',
        'event': 'bg-purple-500',
        'club': 'bg-teal-500',
        'personal': 'bg-gray-500',
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='calendar_events',
    )

    title = models.CharField(max_length=200)
    description = models.TextField(max_length=1000, blank=True)

    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    location = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORIES, default='personal')
    priority = models.CharField(max_length=10, choices=PRIORITIES, default='medium')
    recurring = models.CharField(max_length=10, choices=RECURRING, default='none')

    professor = models.CharField(max_length=100, blank=True)
    course_code = models.CharField(max_length=20, blank=True)
    participants = models.JSONField(default=list, blank=True)

    color = models.CharField(max_length=30, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'start_time']
        indexes = [
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.title} ({self.date})"

    def clean(self):
        if self.start_time and self.end_time and self.end_time < self.start_time:
            raise ValidationError({'end_time': 'End time cannot be before start time.'})

    def save(self, *args, **kwargs):
        if not self.color:
            self.color = self.CATEGORY_COLORS.get(self.category, 'bg-gray-500')
        super().save(*args, **kwargs)
