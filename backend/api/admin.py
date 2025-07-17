from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Notification, NotificationPreference, PushSubscription


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    """Admin configuration for NotificationPreference model"""
    list_display = [
        'user', 
        'email_notifications_status', 
        'push_notifications_status',
        'security_notifications_status',
        'created_at', 
        'updated_at'
    ]
    list_filter = [
        'email_on_follow',
        'email_on_like', 
        'email_on_comment',
        'email_on_new_post',
        'email_on_login',
        'email_on_registration',
        'push_on_follow',
        'push_on_like',
        'push_on_comment', 
        'push_on_new_post',
        'created_at'
    ]
    search_fields = ['user__username', 'user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Email Notifications', {
            'fields': (
                'email_on_follow',
                'email_on_like', 
                'email_on_comment',
                'email_on_new_post'
            ),
            'description': 'Configure which social interactions trigger email notifications'
        }),
        ('Security Notifications', {
            'fields': (
                'email_on_login',
                'email_on_registration'
            ),
            'description': 'Configure security-related email notifications'
        }),
        ('Push Notifications', {
            'fields': (
                'push_on_follow',
                'push_on_like',
                'push_on_comment', 
                'push_on_new_post'
            ),
            'description': 'Configure which interactions trigger push notifications'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def email_notifications_status(self, obj):
        """Display email notification status with color coding"""
        enabled_count = sum([
            obj.email_on_follow,
            obj.email_on_like,
            obj.email_on_comment,
            obj.email_on_new_post,
            obj.email_on_login,
            obj.email_on_registration
        ])
        total_count = 6
        
        if enabled_count == total_count:
            color = 'green'
            status = 'All Enabled'
        elif enabled_count > 0:
            color = 'orange'
            status = f'{enabled_count}/{total_count} Enabled'
        else:
            color = 'red'
            status = 'All Disabled'
            
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, status
        )
    email_notifications_status.short_description = 'Email Status'
    
    def push_notifications_status(self, obj):
        """Display push notification status with color coding"""
        enabled_count = sum([
            obj.push_on_follow,
            obj.push_on_like,
            obj.push_on_comment,
            obj.push_on_new_post
        ])
        total_count = 4
        
        if enabled_count == total_count:
            color = 'green'
            status = 'All Enabled'
        elif enabled_count > 0:
            color = 'orange' 
            status = f'{enabled_count}/{total_count} Enabled'
        else:
            color = 'red'
            status = 'All Disabled'
            
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, status
        )
    push_notifications_status.short_description = 'Push Status'
    
    def security_notifications_status(self, obj):
        """Display security notification status"""
        enabled_count = sum([obj.email_on_login, obj.email_on_registration])
        
        if enabled_count == 2:
            color = 'green'
            status = '🔒 Fully Enabled'
        elif enabled_count == 1:
            color = 'orange'
            status = '🔓 Partially Enabled'
        else:
            color = 'red'
            status = '❌ Disabled'
            
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, status
        )
    security_notifications_status.short_description = 'Security'


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    """Admin configuration for PushSubscription model"""
    list_display = [
        'user',
        'endpoint_display',
        'is_active',
        'created_at',
        'subscription_age'
    ]
    list_filter = ['is_active', 'created_at']
    search_fields = ['user__username', 'user__email', 'endpoint']
    readonly_fields = ['created_at', 'subscription_age', 'endpoint_display']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'is_active')
        }),
        ('Subscription Details', {
            'fields': ('endpoint_display', 'endpoint', 'auth', 'p256dh'),
            'description': 'Push notification subscription details'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'subscription_age'),
            'classes': ('collapse',)
        })
    )
    
    def endpoint_display(self, obj):
        """Display shortened endpoint URL"""
        if len(obj.endpoint) > 50:
            return f"{obj.endpoint[:47]}..."
        return obj.endpoint
    endpoint_display.short_description = 'Endpoint (shortened)'
    
    def subscription_age(self, obj):
        """Display how long the subscription has been active"""
        from django.utils import timezone
        age = timezone.now() - obj.created_at
        
        if age.days > 0:
            return f"{age.days} days"
        elif age.seconds > 3600:
            hours = age.seconds // 3600
            return f"{hours} hours"
        else:
            minutes = age.seconds // 60
            return f"{minutes} minutes"
    subscription_age.short_description = 'Age'


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin configuration for Notification model"""
    list_display = [
        'title',
        'recipient',
        'sender',
        'notification_type',
        'status_display',
        'delivery_status',
        'created_at'
    ]
    list_filter = [
        'notification_type',
        'is_read',
        'email_sent',
        'push_sent',
        'created_at'
    ]
    search_fields = [
        'title',
        'message',
        'recipient__username',
        'recipient__email',
        'sender__username'
    ]
    readonly_fields = [
        'created_at',
        'content_object_display',
        'notification_age',
        'delivery_summary'
    ]
    
    fieldsets = (
        ('Notification Details', {
            'fields': (
                'recipient',
                'sender', 
                'notification_type',
                'title',
                'message'
            )
        }),
        ('Related Content', {
            'fields': (
                'content_type',
                'object_id',
                'content_object_display'
            ),
            'classes': ('collapse',),
            'description': 'The content this notification is related to'
        }),
        ('Status', {
            'fields': (
                'is_read',
                'email_sent',
                'push_sent',
                'delivery_summary'
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'notification_age'),
            'classes': ('collapse',)
        })
    )
    
    def status_display(self, obj):
        """Display read status with color coding"""
        if obj.is_read:
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Read</span>'
            )
        else:
            return format_html(
                '<span style="color: orange; font-weight: bold;">● Unread</span>'
            )
    status_display.short_description = 'Status'
    
    def delivery_status(self, obj):
        """Display delivery status for email and push"""
        email_icon = '📧' if obj.email_sent else '❌'
        push_icon = '🔔' if obj.push_sent else '❌'
        
        return format_html(
            '<span title="Email: {}, Push: {}">{} {}</span>',
            'Sent' if obj.email_sent else 'Not sent',
            'Sent' if obj.push_sent else 'Not sent',
            email_icon,
            push_icon
        )
    delivery_status.short_description = 'Delivery'
    
    def content_object_display(self, obj):
        """Display related content object with link if possible"""
        if obj.content_object:
            return format_html(
                '<strong>{}</strong>: {}',
                obj.content_type.name.title(),
                str(obj.content_object)
            )
        return "No related object"
    content_object_display.short_description = 'Related Content'
    
    def notification_age(self, obj):
        """Display how old the notification is"""
        from django.utils import timezone
        age = timezone.now() - obj.created_at
        
        if age.days > 0:
            return f"{age.days} days ago"
        elif age.seconds > 3600:
            hours = age.seconds // 3600
            return f"{hours} hours ago"
        else:
            minutes = age.seconds // 60
            return f"{minutes} minutes ago"
    notification_age.short_description = 'Age'
    
    def delivery_summary(self, obj):
        """Summary of delivery methods used"""
        methods = []
        if obj.email_sent:
            methods.append('📧 Email')
        if obj.push_sent:
            methods.append('🔔 Push')
        
        if methods:
            return mark_safe(' + '.join(methods))
        return "No delivery methods used"
    delivery_summary.short_description = 'Delivery Methods'
    
    # Custom actions
    actions = ['mark_as_read', 'mark_as_unread']
    
    def mark_as_read(self, request, queryset):
        """Mark selected notifications as read"""
        count = queryset.update(is_read=True)
        self.message_user(
            request,
            f'Successfully marked {count} notification(s) as read.'
        )
    mark_as_read.short_description = "Mark selected notifications as read"
    
    def mark_as_unread(self, request, queryset):
        """Mark selected notifications as unread"""
        count = queryset.update(is_read=False)
        self.message_user(
            request,
            f'Successfully marked {count} notification(s) as unread.'
        )
    mark_as_unread.short_description = "Mark selected notifications as unread"


# Admin site customization
admin.site.site_header = "UFAZIEN Administration"
admin.site.site_title = "UFAZIEN Admin"
admin.site.index_title = "Welcome to UFAZIEN Administration"
