from rest_framework import serializers
from .models import Notification, NotificationPreference, PushSubscription, Feedback

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        exclude = ['user', 'created_at', 'updated_at']

class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ['endpoint', 'auth', 'p256dh']
    
    def create(self, validated_data):
        # Remove existing subscription for same endpoint
        PushSubscription.objects.filter(
            user=self.context['request'].user,
            endpoint=validated_data['endpoint']
        ).delete()
        
        # Create new subscription
        return PushSubscription.objects.create(
            user=self.context['request'].user,
            **validated_data
        )

class NotificationSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_name = serializers.SerializerMethodField()
    time_since = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message',
            'sender_username', 'sender_name', 'is_read',
            'created_at', 'time_since', 'object_id'
        ]
    
    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.get_full_name() or obj.sender.username
        return None
    
    def get_time_since(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at)


class FeedbackSerializer(serializers.ModelSerializer):
    """Serializer for creating feedback"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    time_since = serializers.SerializerMethodField()
    
    class Meta:
        model = Feedback
        fields = [
            'id', 'feedback_type', 'subject', 'message', 
            'status', 'admin_response', 'created_at', 
            'updated_at', 'user_username', 'time_since'
        ]
        read_only_fields = ['id', 'status', 'admin_response', 'created_at', 'updated_at', 'user_username', 'time_since']
    
    def get_time_since(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at)
    
    def validate_subject(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError("Subject must be at least 5 characters long.")
        return value.strip()
    
    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Message must be at least 10 characters long.")
        return value.strip()
