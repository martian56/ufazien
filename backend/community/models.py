from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinLengthValidator, MaxLengthValidator
from django.utils import timezone
import uuid

User = get_user_model()


class TimeStampedModel(models.Model):
    """Abstract base model with timestamps"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True


class Group(TimeStampedModel):
    """Study groups that users can join to chat and collaborate"""
    GROUP_TYPES = [
        ('public', 'Public'),
        ('private', 'Private'),
        ('course', 'Course-specific'),
    ]
    
    CATEGORIES = [
        ('study', 'Study'),
        ('tech', 'Technology'),
        ('language', 'Language'),
        ('hobby', 'Hobby'),
        ('project', 'Project'),
        ('social', 'Social'),
        ('academic', 'Academic'),
        ('career', 'Career'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, validators=[MinLengthValidator(3)])
    description = models.TextField(max_length=500)
    category = models.CharField(max_length=20, choices=CATEGORIES, default='study')
    type = models.CharField(max_length=10, choices=GROUP_TYPES, default='public')
    
    # Group limits and permissions
    max_members = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)
    
    # Course-specific fields (optional)
    course_code = models.CharField(max_length=20, blank=True, null=True)
    professor = models.CharField(max_length=100, blank=True, null=True)
    
    # Relationships
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_groups')
    moderators = models.ManyToManyField(User, related_name='moderated_groups', blank=True)
    members = models.ManyToManyField(User, through='GroupMembership', related_name='joined_groups')
    
    # Metadata
    avatar = models.ImageField(upload_to='groups/avatars/', blank=True, null=True)
    tags = models.JSONField(default=list, blank=True)  # List of tags for filtering
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'type']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.name
    
    @property
    def member_count(self):
        return self.members.count()
    
    @property
    def is_full(self):
        return self.member_count >= self.max_members
    
    def can_join(self, user):
        """Check if user can join this group"""
        if self.is_full:
            return False
        if self.type == 'private':
            return False  # Private groups require invitation
        return not self.members.filter(id=user.id).exists()


class GroupMembership(TimeStampedModel):
    """Through model for group membership with additional metadata"""
    ROLES = [
        ('member', 'Member'),
        ('moderator', 'Moderator'),
        ('owner', 'Owner'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLES, default='member')
    is_muted = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ('user', 'group')
        indexes = [
            models.Index(fields=['user', 'role']),
        ]


class GroupMessage(TimeStampedModel):
    """Messages within groups for real-time chat"""
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('file', 'File'),
        ('system', 'System'),  # Join/leave notifications
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_messages')
    
    content = models.TextField(max_length=2000)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    
    # File attachments
    file_attachment = models.FileField(upload_to='groups/files/', blank=True, null=True)
    image_attachment = models.ImageField(upload_to='groups/images/', blank=True, null=True)
    
    # Message status
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['group', 'created_at']),
            models.Index(fields=['sender']),
        ]
    
    def __str__(self):
        return f"{self.sender.username} in {self.group.name}: {self.content[:50]}"


class Forum(TimeStampedModel):
    """Forum categories for structured discussions"""
    CATEGORIES = [
        ('general', 'General'),
        ('academic', 'Academic'),
        ('career', 'Career'),
        ('tech', 'Technology'),
        ('social', 'Social'),
        ('hobby', 'Hobby'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=100)
    description = models.TextField(max_length=500)
    category = models.CharField(max_length=20, choices=CATEGORIES, default='general')
    
    # Forum metadata
    icon_name = models.CharField(max_length=50, default='MessageCircle')  # Lucide icon name
    color_class = models.CharField(max_length=50, default='bg-blue-500')  # Tailwind color class
    
    # Permissions
    is_active = models.BooleanField(default=True)
    moderators = models.ManyToManyField(User, related_name='moderated_forums', blank=True)
    
    class Meta:
        ordering = ['title']
    
    def __str__(self):
        return self.title
    
    @property
    def post_count(self):
        return self.posts.count()
    
    @property
    def member_count(self):
        return User.objects.filter(forum_posts__forum=self).distinct().count()
    
    @property
    def last_post(self):
        return self.posts.order_by('-created_at').first()


class ForumPost(TimeStampedModel):
    """Individual posts within forums"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    forum = models.ForeignKey(Forum, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_posts')
    
    title = models.CharField(max_length=200, validators=[MinLengthValidator(5)])
    content = models.TextField(max_length=5000)
    
    # Post metadata
    tags = models.JSONField(default=list, blank=True)  # List of tags
    is_pinned = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    
    # Engagement tracking
    view_count = models.PositiveIntegerField(default=0)
    likes = models.ManyToManyField(User, through='PostLike', related_name='liked_posts')
    bookmarks = models.ManyToManyField(User, related_name='bookmarked_posts', blank=True)
    
    class Meta:
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['forum', '-created_at']),
            models.Index(fields=['author']),
            models.Index(fields=['-is_pinned', '-created_at']),
        ]
    
    def __str__(self):
        return self.title
    
    @property
    def like_count(self):
        return self.likes.count()
    
    @property
    def reply_count(self):
        return self.replies.count()
    
    def is_liked_by(self, user):
        if user.is_anonymous:
            return False
        return self.likes.filter(id=user.id).exists()
    
    def is_bookmarked_by(self, user):
        if user.is_anonymous:
            return False
        return self.bookmarks.filter(id=user.id).exists()


class PostLike(TimeStampedModel):
    """Through model for post likes with timestamp tracking"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ('user', 'post')


class PostAttachment(TimeStampedModel):
    """An image on a forum post.

    GroupMessage could already carry images and files; ForumPost had no way to
    show anything but text.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name='attachments')
    image = models.ImageField(upload_to='forum/posts/')
    caption = models.CharField(max_length=200, blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'created_at']

    def __str__(self):
        return f"Attachment on {self.post_id}"


class PostReply(TimeStampedModel):
    """Replies to forum posts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name='replies')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_replies')
    parent_reply = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='nested_replies')
    
    content = models.TextField(max_length=2000)
    
    # Reply engagement
    likes = models.ManyToManyField(User, related_name='liked_replies', blank=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['post', 'created_at']),
            models.Index(fields=['author']),
        ]
    
    def __str__(self):
        return f"Reply by {self.author.username} on {self.post.title}"
    
    @property
    def like_count(self):
        return self.likes.count()


class PrivateChat(TimeStampedModel):
    """Private chat rooms between users"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participants = models.ManyToManyField(User, related_name='private_chats')
    
    # Chat metadata
    name = models.CharField(max_length=100, blank=True, null=True)  # For group chats
    is_group_chat = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        if self.name:
            return self.name
        participants = list(self.participants.all()[:2])
        if len(participants) == 2:
            return f"Chat between {participants[0].username} and {participants[1].username}"
        return f"Chat {self.id}"
    
    @property
    def last_message(self):
        return self.private_messages.order_by('-created_at').first()


class PrivateMessage(TimeStampedModel):
    """Messages in private chats"""
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('file', 'File'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chat = models.ForeignKey(PrivateChat, on_delete=models.CASCADE, related_name='private_messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_private_messages')
    
    content = models.TextField(max_length=2000)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    
    # File attachments
    file_attachment = models.FileField(upload_to='private_chats/files/', blank=True, null=True)
    image_attachment = models.ImageField(upload_to='private_chats/images/', blank=True, null=True)
    
    # Message status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat', 'created_at']),
            models.Index(fields=['sender']),
        ]
    
    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}"


class UserActivity(TimeStampedModel):
    """Track user activity for engagement analytics"""
    ACTIVITY_TYPES = [
        ('group_join', 'Joined Group'),
        ('group_leave', 'Left Group'),
        ('group_message', 'Sent Group Message'),
        ('post_create', 'Created Post'),
        ('post_like', 'Liked Post'),
        ('post_reply', 'Replied to Post'),
        ('private_message', 'Sent Private Message'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='community_activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    
    # Generic relations to different content types
    content_type = models.CharField(max_length=50, blank=True, null=True)  # 'group', 'post', etc.
    object_id = models.UUIDField(blank=True, null=True)
    
    metadata = models.JSONField(default=dict, blank=True)  # Additional activity data
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['activity_type']),
        ]
