from django.contrib import admin
from .models import (
    SubscriptionPlan, UserSubscription, Website, Database, Domain,
    Deployment, SSLCertificate, BandwidthUsage, WebsiteAnalytics,
    BackupJob, Invoice, ActivityLog
)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'name', 'price', 'max_websites', 'max_databases', 'storage_limit_mb']
    list_filter = ['ssl_included', 'custom_domains', 'priority_support']
    ordering = ['price']


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'status', 'started_at', 'next_billing_date']
    list_filter = ['plan', 'status']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['started_at']


@admin.register(Website)
class WebsiteAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'website_type', 'status', 'storage_used_mb', 'total_visits', 'created_at']
    list_filter = ['website_type', 'status', 'created_at']
    search_fields = ['name', 'user__username', 'description']
    readonly_fields = ['id', 'storage_used_mb', 'last_deployment', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'description', 'user', 'website_type', 'status')
        }),
        ('Configuration', {
            'fields': ('domain', 'database', 'git_repository', 'deployment_branch', 'build_command', 'install_command', 'output_directory')
        }),
        ('Statistics', {
            'fields': ('storage_used_mb', 'total_visits', 'last_deployment'),
            'classes': ('collapse',)
        }),
        ('Environment', {
            'fields': ('environment_variables',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(Database)
class DatabaseAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'db_type', 'status', 'host', 'port', 'size_mb', 'created_at']
    list_filter = ['db_type', 'status', 'created_at']
    search_fields = ['name', 'user__username']
    readonly_fields = ['id', 'username', 'password', 'size_mb', 'created_at', 'updated_at']


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'domain_type', 'status', 'ssl_enabled', 'created_at']
    list_filter = ['domain_type', 'status', 'ssl_enabled']
    search_fields = ['name', 'user__username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Deployment)
class DeploymentAdmin(admin.ModelAdmin):
    list_display = ['website', 'status', 'commit_hash', 'deploy_time_seconds', 'started_at', 'completed_at']
    list_filter = ['status', 'started_at']
    search_fields = ['website__name', 'commit_hash', 'commit_message']
    readonly_fields = ['id', 'deploy_time_seconds', 'started_at', 'completed_at']
    
    fieldsets = (
        ('Deployment Info', {
            'fields': ('id', 'website', 'status', 'commit_hash', 'commit_message')
        }),
        ('Logs', {
            'fields': ('build_log', 'error_message'),
            'classes': ('collapse',)
        }),
        ('Timing', {
            'fields': ('deploy_time_seconds', 'started_at', 'completed_at')
        })
    )


@admin.register(SSLCertificate)
class SSLCertificateAdmin(admin.ModelAdmin):
    list_display = ['domain', 'status', 'issuer', 'issued_at', 'expires_at', 'auto_renew']
    list_filter = ['status', 'issuer', 'auto_renew']
    search_fields = ['domain__name']
    readonly_fields = ['issued_at', 'expires_at']


@admin.register(BandwidthUsage)
class BandwidthUsageAdmin(admin.ModelAdmin):
    list_display = ['website', 'date', 'bandwidth_mb', 'requests_count']
    list_filter = ['date']
    search_fields = ['website__name']
    date_hierarchy = 'date'


@admin.register(WebsiteAnalytics)
class WebsiteAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['website', 'date', 'page_views', 'unique_visitors', 'bounce_rate', 'avg_session_duration']
    list_filter = ['date']
    search_fields = ['website__name']
    date_hierarchy = 'date'
    readonly_fields = ['top_pages', 'referrers']


@admin.register(BackupJob)
class BackupJobAdmin(admin.ModelAdmin):
    list_display = ['user', 'backup_type', 'status', 'file_size_mb', 'created_at', 'completed_at']
    list_filter = ['backup_type', 'status', 'created_at']
    search_fields = ['user__username', 'website__name', 'database__name']
    readonly_fields = ['id', 'file_path', 'file_size_mb', 'created_at', 'completed_at']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'user', 'amount', 'currency', 'status', 'due_date', 'paid_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['invoice_number', 'user__username', 'user__email']
    readonly_fields = ['id', 'invoice_number', 'created_at']
    date_hierarchy = 'created_at'


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'description', 'ip_address', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['user__username', 'description', 'ip_address']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
