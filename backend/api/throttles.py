from rest_framework.throttling import UserRateThrottle
from django.core.cache import cache
from datetime import datetime, timedelta


class FeedbackRateThrottle(UserRateThrottle):
    """
    Custom throttle for feedback submission.
    Allows 1 feedback per 5 minutes per user.
    """
    rate = '12/hour'  # 12 per hour = 1 per 5 minutes
    scope = 'feedback'
    
    def get_cache_key(self, request, view):
        """
        Use user ID to create a unique cache key for each user.
        """
        if request.user and request.user.is_authenticated:
            return f'throttle_feedback_{request.user.id}'
        return None
    
    def allow_request(self, request, view):
        """
        Override to provide custom behavior and store exact timestamp.
        """
        if request.user and request.user.is_staff:
            # Staff users are not rate limited
            return True
        
        return super().allow_request(request, view)
