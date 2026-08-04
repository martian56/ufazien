from rest_framework import serializers

from .models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    """The UI uses camelCase for these three; keep both spellings available."""

    startTime = serializers.TimeField(source='start_time', required=False)
    endTime = serializers.TimeField(source='end_time', required=False)
    courseCode = serializers.CharField(
        source='course_code', required=False, allow_blank=True
    )

    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'date',
            'start_time', 'end_time', 'startTime', 'endTime',
            'location', 'category', 'priority', 'recurring',
            'professor', 'course_code', 'courseCode',
            'participants', 'color', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'start_time': {'required': False},
            'end_time': {'required': False},
            'course_code': {'required': False},
        }

    def validate(self, attrs):
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end = attrs.get('end_time', getattr(self.instance, 'end_time', None))

        if start is None or end is None:
            raise serializers.ValidationError(
                {'start_time': 'Both a start time and an end time are required.'}
            )
        if end < start:
            raise serializers.ValidationError(
                {'end_time': 'End time cannot be before start time.'}
            )
        return attrs
