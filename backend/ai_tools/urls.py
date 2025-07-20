from django.urls import path
from . import views

app_name = 'ai_tools'

urlpatterns = [
    # Service status and configuration
    path('status/', views.ai_tools_status, name='ai_tools_status'),
    
    # Text processing endpoints
    path('humanizer/', views.humanize_text, name='humanize_text'),
    path('process/', views.process_text, name='process_text'),
    
    # Task management
    path('tasks/<uuid:task_id>/', views.task_detail, name='task_detail'),
    path('tasks/<uuid:task_id>/status/', views.task_status, name='task_status'),
    path('tasks/<uuid:task_id>/cancel/', views.cancel_task, name='cancel_task'),
    path('tasks/', views.task_history, name='task_history'),
    
    # User statistics
    path('stats/', views.user_stats, name='user_stats'),
]