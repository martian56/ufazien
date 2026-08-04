from django.contrib import admin

from .models import CalendarEvent


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'date', 'start_time', 'category', 'priority']
    list_filter = ['category', 'priority', 'recurring', 'date']
    search_fields = ['title', 'description', 'course_code', 'professor']
    date_hierarchy = 'date'
    raw_id_fields = ['user']
