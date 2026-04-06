from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

User = get_user_model()

class NotificationPreference(models.Model):
    """User notification preferences"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    
    # Email notifications
    email_on_follow = models.BooleanField(default=True)
    email_on_like = models.BooleanField(default=True)
    email_on_comment = models.BooleanField(default=True)
    email_on_new_post = models.BooleanField(default=True)
    
    # Security notifications
    email_on_login = models.BooleanField(default=True)
    email_on_registration = models.BooleanField(default=True)
    
    # Push notifications
    push_on_follow = models.BooleanField(default=True)
    push_on_like = models.BooleanField(default=True)
    push_on_comment = models.BooleanField(default=True)
    push_on_new_post = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Notification preferences for {self.user.username}"


class PushSubscription(models.Model):
    """Store push notification subscriptions"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=500)
    auth = models.CharField(max_length=255)
    p256dh = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('user', 'endpoint')
    
    def __str__(self):
        return f"Push subscription for {self.user.username}"


class Notification(models.Model):
    """In-app notifications (for future use)"""
    NOTIFICATION_TYPES = [
        ('follow', 'New Follower'),
        ('like_post', 'Post Liked'),
        ('like_comment', 'Comment Liked'),
        ('comment', 'New Comment'),
        ('new_post', 'New Post Published'),
    ]
    
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_notifications', null=True, blank=True)
    
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Generic foreign key to link to any model (blog post, comment, etc.)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    is_read = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    push_sent = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.recipient.username}"

class Feedback(models.Model):
    """User feedback model"""
    FEEDBACK_TYPES = [
        ('bug', 'Bug Report'),
        ('vulnerability', 'Security Vulnerability'),
        ('feature', 'Feature Request'),
        ('improvement', 'Improvement Suggestion'),
        ('share_me_on_testimonials', 'Share Me on Testimonials'),
        ('general', 'General Feedback'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_review', 'In Review'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    
    feedback_type = models.CharField(max_length=30, choices=FEEDBACK_TYPES)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedbacks')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_response = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Feedback from {self.user.username} - {self.feedback_type} - {self.subject}"
