from django.urls import path
from . import views

urlpatterns = [
    path('', views.ApiStatus.as_view(), name='api_status'),
    
    # Notification endpoints
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/count/', views.notification_count, name='notification-count'),
    path('notifications/mark-read/', views.mark_notifications_as_read, name='mark-notifications-read'),
    path('notifications/preferences/', views.NotificationPreferenceView.as_view(), name='notification-preferences'),
    
    # Push notification endpoints
    path('notifications/push/subscribe/', views.subscribe_push_notifications, name='push-subscribe'),
    path('notifications/push/unsubscribe/', views.unsubscribe_push_notifications, name='push-unsubscribe'),
    path('notifications/vapid-key/', views.get_vapid_public_key, name='vapid-key'),
]