from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'events', views.CalendarEventViewSet, basename='calendar-event')

app_name = 'schedule'

urlpatterns = [
    path('', include(router.urls)),
]
