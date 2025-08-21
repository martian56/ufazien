from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router for ViewSets
router = DefaultRouter()
router.register(r'subscription-plans', views.SubscriptionPlanViewSet)
router.register(r'subscriptions', views.UserSubscriptionViewSet, basename='subscription')
router.register(r'websites', views.WebsiteViewSet, basename='website')
router.register(r'databases', views.DatabaseViewSet, basename='database')
router.register(r'domains', views.DomainViewSet, basename='domain')
router.register(r'ssl-certificates', views.SSLCertificateViewSet, basename='ssl-certificate')
router.register(r'backups', views.BackupJobViewSet, basename='backup')
router.register(r'invoices', views.InvoiceViewSet, basename='invoice')
router.register(r'activity-logs', views.ActivityLogViewSet, basename='activity-log')
router.register(r'deployments', views.DeploymentViewSet, basename='deployment')

app_name = 'hosting'

urlpatterns = [
    # API endpoints
    path('', include(router.urls)),
    
    # Custom API views
    path('dashboard/', views.DashboardAPIView.as_view(), name='dashboard'),
    path('dashboard/stats/', views.DashboardAPIView.as_view(), name='dashboard-stats'),
    path('analytics/', views.AnalyticsAPIView.as_view(), name='analytics'),
    path('analytics/bandwidth/', views.BandwidthAnalyticsAPIView.as_view(), name='bandwidth-analytics'),
    path('create-sample-logs/', views.create_sample_logs, name='create-sample-logs'),

    # Webhook endpoints
    path('webhooks/deployment-status/', views.webhook_deployment_status, name='webhook-deployment'),
    path('webhooks/analytics/', views.webhook_analytics, name='webhook-analytics'),
]