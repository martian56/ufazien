from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register('groups', views.GroupViewSet, basename='group')
router.register('forums', views.ForumViewSet)
router.register('posts', views.ForumPostViewSet, basename='forumpost')
router.register('replies', views.PostReplyViewSet, basename='postreply')
router.register('chats', views.PrivateChatViewSet, basename='privatechat')
router.register('activity', views.UserActivityViewSet, basename='useractivity')

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    
    # Additional API endpoints
    path('stats/', views.CommunityStatsView.as_view(), name='community-stats'),
    path('recommended-groups/', views.RecommendedGroupsView.as_view(), name='recommended-groups'),
]