from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from blog.models import BlogPostLike, Comment, CommentLike, BlogPost
from users.models import User
from .services.notification_service import NotificationService

@receiver(post_save, sender=BlogPostLike)
def notify_post_liked(sender, instance, created, **kwargs):
    """Send notification when a post is liked"""
    if created:
        NotificationService.notify_post_liked(instance.user, instance.post)

@receiver(post_save, sender=CommentLike)
def notify_comment_liked(sender, instance, created, **kwargs):
    """Send notification when a comment is liked"""
    if created:
        NotificationService.notify_comment_liked(instance.user, instance.comment)

@receiver(post_save, sender=Comment)
def notify_new_comment(sender, instance, created, **kwargs):
    """Send notification when someone comments on a post"""
    if created:
        NotificationService.notify_new_comment(
            instance.author, 
            instance.post, 
            instance
        )

@receiver(post_save, sender=BlogPost)
def notify_followers_new_post(sender, instance, created, **kwargs):
    """
    Send notification to followers when a post is published.

    On the transition, not on creation. This read `created and is_published`,
    and the editor saves a draft first and publishes by PATCHing it — so at
    publish time the row already existed, `created` was False, and nothing
    written through the UI ever notified anybody. A post published straight
    from the API did, which is what made it look like it worked.

    `announce_new_post` decides whether this post is one to announce and makes
    sure it is announced once.
    """
    NotificationService.announce_new_post(instance)

@receiver(m2m_changed, sender=User.followers.through)
def notify_new_follower(sender, instance, pk_set, action, **kwargs):
    """Send notification when someone follows a user"""
    if action == 'post_add':
        for follower_id in pk_set:
            try:
                follower = User.objects.get(pk=follower_id)
                NotificationService.notify_new_follower(instance, follower)
            except User.DoesNotExist:
                pass
