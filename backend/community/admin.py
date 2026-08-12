from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.db.models import Count
from .models import (
    Group, GroupMembership, GroupMessage, Forum, ForumPost, 
    PostLike, PostReply, PrivateChat, PrivateMessage, UserActivity,
    PostAttachment
)


class GroupMembershipInline(admin.TabularInline):
    """Inline for group memberships"""
    model = GroupMembership
    extra = 0
    readonly_fields = ('created_at',)
    list_display = ('user', 'role', 'is_muted', 'created_at')


class GroupMessageInline(admin.TabularInline):
    """Inline for group messages (limited)"""
    model = GroupMessage
    extra = 0
    readonly_fields = ('created_at', 'sender')
    fields = ('sender', 'content', 'message_type', 'created_at')
    
    def get_queryset(self, request):
        # Limit to last 10 messages to avoid performance issues
        return super().get_queryset(request).order_by('-created_at')[:10]


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    """Admin for Group model"""
    list_display = ('name', 'category', 'type', 'member_count_display', 'owner', 'is_active', 'created_at')
    list_filter = ('category', 'type', 'is_active', 'created_at')
    search_fields = ('name', 'description', 'course_code', 'owner__username')
    readonly_fields = ('id', 'created_at', 'updated_at', 'member_count_display')
    filter_horizontal = ('moderators',)
    inlines = [GroupMembershipInline, GroupMessageInline]
    
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'category', 'type')
        }),
        ('Settings', {
            'fields': ('max_members', 'is_active', 'avatar')
        }),
        ('Course Information', {
            'fields': ('course_code', 'professor'),
            'classes': ('collapse',)
        }),
        ('Management', {
            'fields': ('owner', 'moderators', 'tags')
        }),
        ('Metadata', {
            'fields': ('id', 'member_count_display', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    @admin.display(description="Members")
    def member_count_display(self, obj):
        return f"{obj.member_count}/{obj.max_members}"
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('owner').annotate(
            member_count=Count('members')
        )
    
    actions = ['deactivate_groups', 'activate_groups']
    
    @admin.action(description="Deactivate selected groups")
    def deactivate_groups(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} groups deactivated.')
    
    @admin.action(description="Activate selected groups")
    def activate_groups(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} groups activated.')


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    """Admin for GroupMembership model"""
    list_display = ('user', 'group', 'role', 'is_muted', 'created_at')
    list_filter = ('role', 'is_muted', 'created_at')
    search_fields = ('user__username', 'group__name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    """Admin for GroupMessage model"""
    list_display = ('sender', 'group', 'message_preview', 'message_type', 'created_at')
    list_filter = ('message_type', 'created_at', 'group__category')
    search_fields = ('sender__username', 'group__name', 'content')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    @admin.display(description="Message")
    def message_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('sender', 'group')


class PostReplyInline(admin.TabularInline):
    """Inline for post replies"""
    model = PostReply
    extra = 0
    readonly_fields = ('created_at', 'author')
    fields = ('author', 'content', 'parent_reply', 'created_at')
    
    def get_queryset(self, request):
        # Limit to avoid performance issues
        return super().get_queryset(request).order_by('-created_at')[:10]


@admin.register(Forum)
class ForumAdmin(admin.ModelAdmin):
    """Admin for Forum model"""
    list_display = ('title', 'category', 'post_count_display', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at', 'post_count_display')
    filter_horizontal = ('moderators',)
    
    @admin.display(description="Posts")
    def post_count_display(self, obj):
        return obj.post_count
    
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            post_count_annotated=Count('posts')
        )


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    """Admin for ForumPost model"""
    list_display = ('title', 'author', 'forum', 'like_count_display', 'reply_count_display', 'is_pinned', 'created_at')
    list_filter = ('forum', 'is_pinned', 'is_locked', 'created_at', 'forum__category')
    search_fields = ('title', 'content', 'author__username')
    readonly_fields = ('id', 'view_count', 'like_count_display', 'reply_count_display', 'created_at', 'updated_at')
    filter_horizontal = ('bookmarks',)
    inlines = [PostReplyInline]
    
    fieldsets = (
        (None, {
            'fields': ('title', 'content', 'author', 'forum')
        }),
        ('Settings', {
            'fields': ('tags', 'is_pinned', 'is_locked')
        }),
        ('Engagement', {
            'fields': ('view_count', 'like_count_display', 'reply_count_display', 'bookmarks'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    @admin.display(description="Likes")
    def like_count_display(self, obj):
        return obj.like_count
    
    @admin.display(description="Replies")
    def reply_count_display(self, obj):
        return obj.reply_count
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'forum').annotate(
            like_count_annotated=Count('likes'),
            reply_count_annotated=Count('replies')
        )
    
    actions = ['pin_posts', 'unpin_posts', 'lock_posts', 'unlock_posts']
    
    @admin.action(description="Pin selected posts")
    def pin_posts(self, request, queryset):
        updated = queryset.update(is_pinned=True)
        self.message_user(request, f'{updated} posts pinned.')
    
    @admin.action(description="Unpin selected posts")
    def unpin_posts(self, request, queryset):
        updated = queryset.update(is_pinned=False)
        self.message_user(request, f'{updated} posts unpinned.')
    
    @admin.action(description="Lock selected posts")
    def lock_posts(self, request, queryset):
        updated = queryset.update(is_locked=True)
        self.message_user(request, f'{updated} posts locked.')
    
    @admin.action(description="Unlock selected posts")
    def unlock_posts(self, request, queryset):
        updated = queryset.update(is_locked=False)
        self.message_user(request, f'{updated} posts unlocked.')


@admin.register(PostReply)
class PostReplyAdmin(admin.ModelAdmin):
    """Admin for PostReply model"""
    list_display = ('author', 'post', 'content_preview', 'parent_reply', 'like_count_display', 'created_at')
    list_filter = ('created_at', 'post__forum')
    search_fields = ('content', 'author__username', 'post__title')
    readonly_fields = ('id', 'like_count_display', 'created_at', 'updated_at')
    
    @admin.display(description="Content")
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    
    @admin.display(description="Likes")
    def like_count_display(self, obj):
        return obj.like_count
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'post', 'parent_reply')


class PrivateMessageInline(admin.TabularInline):
    """Inline for private messages"""
    model = PrivateMessage
    extra = 0
    readonly_fields = ('created_at', 'sender')
    fields = ('sender', 'content', 'message_type', 'is_read', 'created_at')
    
    def get_queryset(self, request):
        # Limit to last 10 messages
        return super().get_queryset(request).order_by('-created_at')[:10]


@admin.register(PrivateChat)
class PrivateChatAdmin(admin.ModelAdmin):
    """Admin for PrivateChat model"""
    list_display = ('chat_name', 'participant_list', 'is_group_chat', 'message_count', 'created_at')
    list_filter = ('is_group_chat', 'created_at')
    search_fields = ('name', 'participants__username')
    readonly_fields = ('id', 'created_at', 'updated_at', 'message_count')
    filter_horizontal = ('participants',)
    inlines = [PrivateMessageInline]
    
    @admin.display(description="Chat Name")
    def chat_name(self, obj):
        if obj.name:
            return obj.name
        participants = list(obj.participants.all()[:2])
        if len(participants) == 2:
            return f"{participants[0].username} & {participants[1].username}"
        return f"Chat {obj.id}"
    
    @admin.display(description="Participants")
    def participant_list(self, obj):
        participants = obj.participants.all()[:5]
        names = [p.username for p in participants]
        if obj.participants.count() > 5:
            names.append(f"+{obj.participants.count() - 5} more")
        return ", ".join(names)
    
    @admin.display(description="Messages")
    def message_count(self, obj):
        return obj.private_messages.count()
    
    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('participants')


@admin.register(PrivateMessage)
class PrivateMessageAdmin(admin.ModelAdmin):
    """Admin for PrivateMessage model"""
    list_display = ('sender', 'chat_name', 'message_preview', 'message_type', 'is_read', 'created_at')
    list_filter = ('message_type', 'is_read', 'created_at')
    search_fields = ('sender__username', 'content', 'chat__name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    @admin.display(description="Chat")
    def chat_name(self, obj):
        return obj.chat.name or f"Chat {obj.chat.id}"
    
    @admin.display(description="Message")
    def message_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('sender', 'chat')


@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    """Admin for UserActivity model"""
    list_display = ('user', 'activity_type', 'content_type', 'created_at')
    list_filter = ('activity_type', 'content_type', 'created_at')
    search_fields = ('user__username', 'metadata')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


# Custom admin site configuration
admin.site.site_header = "Ufazien Community Administration"
admin.site.site_title = "Ufazien Admin"
admin.site.index_title = "Community Management"


@admin.register(PostAttachment)
class PostAttachmentAdmin(admin.ModelAdmin):
    """Images hung off a forum post, in the order they are shown."""

    list_display = ['post', 'caption', 'position', 'created_at']
    list_filter = ['created_at']
    search_fields = ['caption', 'post__title']
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_select_related = ['post']
    ordering = ['post', 'position']


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'post__title']
    readonly_fields = ['created_at', 'updated_at']
    list_select_related = ['user', 'post']
