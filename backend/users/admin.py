from django.contrib import admin
from django.contrib.auth import get_user_model
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.db.models import Count

User = get_user_model()

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    # Display fields in the list view
    list_display = (
        'id', 'username', 'email', 'get_full_name', 'major', 'year', 
        'gpa', 'is_active', 'is_staff', 'date_joined', 'last_login',
        'followers_count', 'following_count'
    )
    
    # Fields that can be clicked to edit
    list_display_links = ('id', 'username', 'email')
    
    # Search functionality
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone')
    
    # Filter options
    list_filter = (
        'is_staff', 'is_active', 'is_superuser', 'major', 'year',
        'date_joined', 'last_login'
    )
    
    # Default ordering (by join date, newest first)
    ordering = ('-date_joined',)
    
    # Fields that can be edited directly in the list view
    list_editable = ('is_active', 'is_staff', 'major', 'year')
    
    # Number of items per page
    list_per_page = 25
    
    # Fieldsets for the detail/edit view
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'username', 'email', 'first_name', 'last_name')
        }),
        ('Academic Information', {
            'fields': ('major', 'year', 'gpa', 'completed_credits'),
            'classes': ('collapse',)
        }),
        ('Profile Information', {
            'fields': ('bio', 'avatar', 'phone'),
            'classes': ('collapse',)
        }),
        ('Social Information', {
            'fields': ('followers',),
            'classes': ('collapse',)
        }),
        ('Permissions & Status', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        ('Important Dates', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',)
        }),
    )
    
    # Read-only fields
    readonly_fields = ('id', 'date_joined', 'last_login', 'followers_count', 'following_count')
    
    # Filter horizontal for many-to-many fields
    filter_horizontal = ('followers', 'groups', 'user_permissions')
    
    # Custom methods for display
    def get_full_name(self, obj):
        """Display full name with fallback to username"""
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username
    get_full_name.short_description = 'Full Name'
    get_full_name.admin_order_field = 'first_name'
    
    def followers_count(self, obj):
        """Display number of followers"""
        return obj.followers.count()
    followers_count.short_description = 'Followers'
    followers_count.admin_order_field = 'followers__count'
    
    def following_count(self, obj):
        """Display number of following"""
        return obj.following.count()
    following_count.short_description = 'Following'
    following_count.admin_order_field = 'following__count'
    
    def get_queryset(self, request):
        """Optimize queryset with select_related and prefetch_related"""
        queryset = super().get_queryset(request)
        return queryset.select_related().prefetch_related('followers', 'following')
    
    # Custom actions
    actions = ['activate_users', 'deactivate_users', 'make_staff', 'remove_staff']
    
    def activate_users(self, request, queryset):
        """Activate selected users"""
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} users were successfully activated.')
    activate_users.short_description = "Activate selected users"
    
    def deactivate_users(self, request, queryset):
        """Deactivate selected users"""
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} users were successfully deactivated.')
    deactivate_users.short_description = "Deactivate selected users"
    
    def make_staff(self, request, queryset):
        """Make selected users staff"""
        updated = queryset.update(is_staff=True)
        self.message_user(request, f'{updated} users were successfully made staff.')
    make_staff.short_description = "Make selected users staff"
    
    def remove_staff(self, request, queryset):
        """Remove staff status from selected users"""
        updated = queryset.update(is_staff=False)
        self.message_user(request, f'{updated} users were successfully removed from staff.')
    remove_staff.short_description = "Remove staff status from selected users"
