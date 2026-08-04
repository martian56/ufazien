from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import CalendarEvent
from .serializers import CalendarEventSerializer


class CalendarEventViewSet(viewsets.ModelViewSet):
    """CRUD over the requesting user's own calendar events."""

    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'priority', 'date', 'course_code']
    search_fields = ['title', 'description', 'location', 'professor', 'course_code']
    ordering_fields = ['date', 'start_time', 'priority', 'created_at']
    ordering = ['date', 'start_time']

    def get_queryset(self):
        # Scoped to the owner. A calendar is private; there is no route by
        # which one user should read another's schedule.
        queryset = CalendarEvent.objects.filter(user=self.request.user)

        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if start:
            queryset = queryset.filter(date__gte=start)
        if end:
            queryset = queryset.filter(date__lte=end)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
