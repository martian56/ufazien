# Create a default JSON response fro 'api/' endpoint
# THAT will include api documentation urls and a status message
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from datetime import timedelta

from .models import Notification, NotificationPreference, PushSubscription, Feedback
from .serializers import (
    NotificationSerializer, 
    NotificationPreferenceSerializer, 
    PushSubscriptionSerializer,
    FeedbackSerializer
)
from .throttles import FeedbackRateThrottle

class ApiStatus(APIView):
    """
    API status view that returns a simple JSON response with API documentation links.
    """
    def get(self, request):
        return Response({
            "message": "API is running",
            "documentation": {
                "schema": "/api/schema/",
                "swagger_ui": "/api/docs/",
                "redoc": "/api/docs/redoc/"
            }
        }, status=status.HTTP_200_OK)


# Notification Views
class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class NotificationListView(generics.ListAPIView):
    """List user's notifications"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination
    
    def get_queryset(self):
        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related('sender').order_by('-created_at')

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notifications_as_read(request):
    """Mark notifications as read"""
    notification_ids = request.data.get('notification_ids', [])
    
    if notification_ids:
        count = Notification.objects.filter(
            recipient=request.user,
            id__in=notification_ids,
            is_read=False
        ).update(is_read=True)
    else:
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)
    
    return Response({
        'message': f'Marked {count} notifications as read',
        'count': count
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_count(request):
    """Get unread notification count"""
    count = Notification.objects.filter(
        recipient=request.user,
        is_read=False
    ).count()
    return Response({'unread_count': count})

class NotificationPreferenceView(generics.RetrieveUpdateAPIView):
    """Get and update notification preferences"""
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        preference, created = NotificationPreference.objects.get_or_create(
            user=self.request.user
        )
        return preference

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe_push_notifications(request):
    """Subscribe to push notifications"""
    serializer = PushSubscriptionSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Push notifications enabled'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unsubscribe_push_notifications(request):
    """Unsubscribe from push notifications"""
    endpoint = request.data.get('endpoint')
    if endpoint:
        PushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint
        ).update(is_active=False)
        return Response({'message': 'Push notifications disabled'})
    return Response({'error': 'Endpoint required'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_vapid_public_key(request):
    """Get VAPID public key for push notification subscription"""
    from django.conf import settings
    
    # Get the base64 encoded public key from settings
    public_key = getattr(settings, 'VAPID_PUBLIC_KEY_B64', '')
    
    if not public_key:
        return Response({'error': 'VAPID public key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response({'publicKey': public_key})


# Feedback Views
class FeedbackPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50

class FeedbackListCreateView(generics.ListCreateAPIView):
    """
    List user's feedback submissions and create new feedback.
    Rate limited to 1 feedback per 5 minutes.
    """
    serializer_class = FeedbackSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [FeedbackRateThrottle]
    pagination_class = FeedbackPagination
    
    def get_queryset(self):
        """Return only the authenticated user's feedback"""
        return Feedback.objects.filter(user=self.request.user).order_by('-created_at')
    
    def perform_create(self, serializer):
        """Automatically set the user when creating feedback"""
        serializer.save(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Override create to return additional info on success"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        
        return Response({
            'message': 'Feedback submitted successfully. Thank you!',
            'feedback': serializer.data,
            'next_allowed_at': (timezone.now() + timedelta(minutes=5)).isoformat()
        }, status=status.HTTP_201_CREATED, headers=headers)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_rate_limit_status(request):
    """
    Check if user can submit feedback and when they can submit next.
    Returns:
        - can_submit: boolean
        - next_allowed_at: ISO timestamp (if can't submit)
        - seconds_remaining: seconds until next allowed (if can't submit)
    """
    # Get user's last feedback
    last_feedback = Feedback.objects.filter(user=request.user).order_by('-created_at').first()
    
    if not last_feedback:
        return Response({
            'can_submit': True,
            'message': 'You can submit feedback now.'
        })
    
    # Calculate time since last feedback
    now = timezone.now()
    time_since_last = now - last_feedback.created_at
    wait_time = timedelta(minutes=5)
    
    if time_since_last >= wait_time:
        return Response({
            'can_submit': True,
            'message': 'You can submit feedback now.'
        })
    else:
        time_remaining = wait_time - time_since_last
        next_allowed_at = last_feedback.created_at + wait_time
        
        return Response({
            'can_submit': False,
            'message': 'Please wait before submitting another feedback.',
            'next_allowed_at': next_allowed_at.isoformat(),
            'seconds_remaining': int(time_remaining.total_seconds()),
            'last_feedback_at': last_feedback.created_at.isoformat()
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_types(request):
    """Get available feedback types"""
    from .models import Feedback as FeedbackModel
    
    types = [
        {'value': choice[0], 'label': choice[1]} 
        for choice in FeedbackModel.FEEDBACK_TYPES
    ]
    
    return Response({'feedback_types': types})
