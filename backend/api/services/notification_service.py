from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth import get_user_model
import json
import threading
from pywebpush import webpush, WebPushException

from ..models import Notification, NotificationPreference, PushSubscription

User = get_user_model()

class NotificationService:
    """Service for handling email and push notifications"""
    
    @staticmethod
    def send_email_async(subject, message, html_message, recipient_list, from_email=None):
        """Send email asynchronously using threading"""
        def _send_email():
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email or settings.DEFAULT_FROM_EMAIL,
                    recipient_list=recipient_list,
                    html_message=html_message,
                    fail_silently=False,
                )
                print(f"✅ Email sent successfully to {', '.join(recipient_list)}")
            except Exception as e:
                print(f"❌ Error sending email: {e}")
        
        # Start email sending in background thread
        email_thread = threading.Thread(target=_send_email)
        email_thread.daemon = True  # Dies when main thread dies
        email_thread.start()
    
    @staticmethod
    def create_notification(
        recipient,
        notification_type,
        title,
        message,
        sender=None,
        content_object=None,
        send_email=True,
        send_push=True
    ):
        """Create notification and send via email/push if enabled"""
        try:
            # Get or create user preferences
            preferences, created = NotificationPreference.objects.get_or_create(
                user=recipient
            )
            
            # Create notification record
            notification = Notification.objects.create(
                recipient=recipient,
                sender=sender,
                notification_type=notification_type,
                title=title,
                message=message,
                content_object=content_object
            )
            
            # Send email notification if enabled
            if send_email and NotificationService._should_send_email(preferences, notification_type):
                NotificationService._send_email_notification(notification)
            
            # Send push notification if enabled
            if send_push and NotificationService._should_send_push(preferences, notification_type):
                NotificationService._send_push_notification(notification)
            
            return notification
            
        except Exception as e:
            print(f"Error creating notification: {e}")
            return None
    
    @staticmethod
    def _should_send_email(preferences, notification_type):
        """Check if user wants email for this notification type"""
        field_map = {
            'follow': 'email_on_follow',
            'like_post': 'email_on_like',
            'like_comment': 'email_on_like',
            'comment': 'email_on_comment',
            'new_post': 'email_on_new_post',
        }
        field_name = field_map.get(notification_type, 'email_on_like')
        return getattr(preferences, field_name, True)
    
    @staticmethod
    def _should_send_push(preferences, notification_type):
        """Check if user wants push notifications for this type"""
        field_map = {
            'follow': 'push_on_follow',
            'like_post': 'push_on_like',
            'like_comment': 'push_on_like',
            'comment': 'push_on_comment',
            'new_post': 'push_on_new_post',
        }
        field_name = field_map.get(notification_type, 'push_on_like')
        return getattr(preferences, field_name, True)
    
    @staticmethod
    def _send_email_notification(notification):
        """Send email notification"""
        try:
            subject = f"UFAZIEN - {notification.title}"
            
            # Create email context
            context = {
                'notification': notification,
                'recipient': notification.recipient,
                'sender': notification.sender,
                'site_name': 'UFAZIEN',
                'site_url': 'https://ufazien.com',
            }
            
            # Try to render email templates
            try:
                html_message = render_to_string(
                    'notifications/email_notification.html', 
                    context
                )
                plain_message = render_to_string(
                    'notifications/email_notification.txt', 
                    context
                )
            except Exception as template_error:
                print(f"Template error: {template_error}")
                # Fallback to simple email if templates fail
                html_message = f"""
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
                <p>From: {notification.sender.get_full_name() if notification.sender else 'UFAZIEN System'}</p>
                <p><a href="https://ufazien.com/notifications">View all notifications</a></p>
                """
                plain_message = f"{notification.title}\n\n{notification.message}\n\nFrom: {notification.sender.get_full_name() if notification.sender else 'UFAZIEN System'}\n\nView all notifications: https://ufazien.com/notifications"
            
            # Send email asynchronously
            NotificationService.send_email_async(
                subject=subject,
                message=plain_message,
                html_message=html_message,
                recipient_list=[notification.recipient.email]
            )
            
            # Mark as sent immediately (the actual sending happens async)
            notification.email_sent = True
            notification.save(update_fields=['email_sent'])
            
            print(f"📧 Email queued for {notification.recipient.email}")
            
        except Exception as e:
            print(f"❌ Error preparing email notification: {e}")
            # Still try to send a basic email
            try:
                NotificationService.send_email_async(
                    subject=f"UFAZIEN - {notification.title}",
                    message=f"{notification.title}\n\n{notification.message}",
                    html_message=f"<h2>{notification.title}</h2><p>{notification.message}</p>",
                    recipient_list=[notification.recipient.email]
                )
                notification.email_sent = True
                notification.save(update_fields=['email_sent'])
                print(f"📧 Fallback email queued for {notification.recipient.email}")
            except Exception as fallback_error:
                print(f"❌ Even fallback email failed: {fallback_error}")
    
    @staticmethod
    def _send_push_notification(notification):
        """Send push notification to all user's devices"""
        try:
            # Get all active push subscriptions for the user
            subscriptions = PushSubscription.objects.filter(
                user=notification.recipient,
                is_active=True
            )
            
            if not subscriptions.exists():
                return
            
            # Create push payload
            payload = {
                'title': notification.title,
                'body': notification.message,
                'icon': '/icon-192x192.png',
                'badge': '/badge-72x72.png',
                'tag': f'notification-{notification.id}',
                'data': {
                    'notification_id': notification.id,
                    'notification_type': notification.notification_type,
                    'url': NotificationService._get_notification_url(notification),
                },
                'actions': [
                    {
                        'action': 'view',
                        'title': 'View',
                        'icon': '/icon-view.png'
                    },
                    {
                        'action': 'close',
                        'title': 'Close',
                        'icon': '/icon-close.png'
                    }
                ]
            }
            
            # VAPID keys (you'll need to generate these)
            vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
            vapid_public_key = getattr(settings, 'VAPID_PUBLIC_KEY', None)
            vapid_claims = {
                "sub": "mailto:admin@ufazien.com"
            }
            
            if not vapid_private_key or not vapid_public_key:
                print("VAPID keys not configured")
                return
            
            # Send to each subscription
            for subscription in subscriptions:
                try:
                    webpush(
                        subscription_info={
                            "endpoint": subscription.endpoint,
                            "keys": {
                                "p256dh": subscription.p256dh,
                                "auth": subscription.auth
                            }
                        },
                        data=json.dumps(payload),
                        vapid_private_key=vapid_private_key,
                        vapid_claims=vapid_claims
                    )
                except WebPushException as ex:
                    print(f"Push notification failed: {ex}")
                    if ex.response and ex.response.status_code == 410:
                        # Subscription is no longer valid
                        subscription.is_active = False
                        subscription.save()
            
            # Mark as sent
            notification.push_sent = True
            notification.save(update_fields=['push_sent'])
            
        except Exception as e:
            print(f"Error sending push notification: {e}")
    
    @staticmethod
    def _get_notification_url(notification):
        """Get URL for notification based on type"""
        if notification.notification_type == 'like_post' or notification.notification_type == 'comment':
            if hasattr(notification.content_object, 'id'):
                return f"/blog/{notification.content_object.id}"
        elif notification.notification_type == 'follow':
            if notification.sender:
                return f"/profile/{notification.sender.username}"
        elif notification.notification_type == 'new_post':
            if hasattr(notification.content_object, 'id'):
                return f"/blog/{notification.content_object.id}"
        return "/notifications"
    
    # Specific notification methods
    @staticmethod
    def notify_new_follower(follower, following):
        """Notify user when someone follows them"""
        return NotificationService.create_notification(
            recipient=following,
            sender=follower,
            notification_type='follow',
            title='New Follower!',
            message=f'{follower.get_full_name() or follower.username} started following you.',
        )
    
    @staticmethod
    def notify_post_liked(user_who_liked, post):
        """Notify user when their post is liked"""
        if user_who_liked != post.author:
            return NotificationService.create_notification(
                recipient=post.author,
                sender=user_who_liked,
                notification_type='like_post',
                title='Post Liked!',
                message=f'{user_who_liked.get_full_name() or user_who_liked.username} liked your post "{post.title}".',
                content_object=post
            )
    
    @staticmethod
    def notify_comment_liked(user_who_liked, comment):
        """Notify user when their comment is liked"""
        if user_who_liked != comment.author:
            return NotificationService.create_notification(
                recipient=comment.author,
                sender=user_who_liked,
                notification_type='like_comment',
                title='Comment Liked!',
                message=f'{user_who_liked.get_full_name() or user_who_liked.username} liked your comment.',
                content_object=comment
            )
    
    @staticmethod
    def notify_new_comment(commenter, post, comment):
        """Notify user when someone comments on their post"""
        if commenter != post.author:
            return NotificationService.create_notification(
                recipient=post.author,
                sender=commenter,
                notification_type='comment',
                title='New Comment!',
                message=f'{commenter.get_full_name() or commenter.username} commented on your post "{post.title}".',
                content_object=comment
            )
    
    @staticmethod
    def notify_followers_new_post(author, post):
        """Notify followers when user publishes new post"""
        followers = author.followers.all()
        
        for follower in followers:
            NotificationService.create_notification(
                recipient=follower,
                sender=author,
                notification_type='new_post',
                title='New Post Published!',
                message=f'{author.get_full_name() or author.username} published a new post: "{post.title}".',
                content_object=post
            )

    @staticmethod
    def send_welcome_email(user):
        """Send welcome email to newly registered user"""
        try:
            # Check user preferences
            preferences, created = NotificationPreference.objects.get_or_create(
                user=user
            )
            
            if not preferences.email_on_registration:
                print(f"Welcome email skipped for {user.email} - user preference disabled")
                return False
            
            subject = f"Welcome to UFAZIEN - {user.first_name or user.username}!"
            
            # Create email context
            context = {
                'user': user,
                'site_name': 'UFAZIEN',
                'site_url': 'https://ufazien.com',
            }
            
            # Render email templates
            html_message = render_to_string(
                'notifications/welcome_email.html',
                context
            )
            text_message = render_to_string(
                'notifications/welcome_email.txt',
                context
            )
            
            # Send email asynchronously
            NotificationService.send_email_async(
                subject=subject,
                message=text_message,
                html_message=html_message,
                recipient_list=[user.email]
            )
            
            print(f"📧 Welcome email queued for {user.email}")
            return True
            
        except Exception as e:
            print(f"Error sending welcome email: {e}")
            return False

    @staticmethod
    def send_login_alert_email(user, request=None):
        """Send login alert email to user"""
        try:
            # Check user preferences
            preferences, created = NotificationPreference.objects.get_or_create(
                user=user
            )
            
            if not preferences.email_on_login:
                print(f"Login alert email skipped for {user.email} - user preference disabled")
                return False
            
            from django.utils import timezone
            
            subject = "Login Alert - UFAZIEN"
            
            # Get request information
            ip_address = "Unknown"
            user_agent = "Unknown device"
            
            if request:
                # Get IP address
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    ip_address = x_forwarded_for.split(',')[0]
                else:
                    ip_address = request.META.get('REMOTE_ADDR', 'Unknown')
                
                # Get user agent
                user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown device')
            
            # Create email context
            context = {
                'user': user,
                'login_time': timezone.now(),
                'ip_address': ip_address,
                'user_agent': user_agent,
                'site_name': 'UFAZIEN',
                'site_url': 'https://ufazien.com',
            }
            
            # Render email templates
            html_message = render_to_string(
                'notifications/login_alert.html',
                context
            )
            text_message = render_to_string(
                'notifications/login_alert.txt',
                context
            )
            
            # Send email asynchronously
            NotificationService.send_email_async(
                subject=subject,
                message=text_message,
                html_message=html_message,
                recipient_list=[user.email]
            )
            
            print(f"🔐 Login alert email queued for {user.email}")
            return True
            
        except Exception as e:
            print(f"Error sending login alert email: {e}")
            return False
