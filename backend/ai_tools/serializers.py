from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    AITask, HumanizerTask, UserUsageStats, AIToolConfiguration,
    AIToolType, TaskStatus, WritingStyle
)

class AITaskSerializer(serializers.ModelSerializer):
    """Serializer for AI tasks"""
    user = serializers.StringRelatedField(read_only=True)
    duration = serializers.ReadOnlyField()
    is_processing = serializers.ReadOnlyField()
    
    class Meta:
        model = AITask
        fields = [
            'id', 'user', 'tool_type', 'status', 'input_text', 'parameters',
            'output_text', 'processing_time', 'created_at', 'started_at',
            'completed_at', 'error_message', 'input_word_count', 'input_char_count',
            'output_word_count', 'output_char_count', 'duration', 'is_processing'
        ]
        read_only_fields = [
            'id', 'user', 'status', 'output_text', 'processing_time',
            'started_at', 'completed_at', 'error_message', 'input_word_count',
            'input_char_count', 'output_word_count', 'output_char_count'
        ]

class HumanizerTaskCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating humanizer tasks"""
    writing_style = serializers.ChoiceField(choices=WritingStyle.choices, default=WritingStyle.NATURAL)
    preserve_formatting = serializers.BooleanField(default=True)
    target_tone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    input_text = serializers.CharField(max_length=10000)

    class Meta:
        model = HumanizerTask
        fields = ['writing_style', 'preserve_formatting', 'target_tone', 'input_text']

    def validate_input_text(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Input text cannot be empty.")
        
        if len(value) > 10000:
            raise serializers.ValidationError("Input text too long. Maximum 10,000 characters allowed.")
        
        if len(value.split()) < 5:
            raise serializers.ValidationError("Input text too short. Minimum 5 words required.")
        
        return value.strip()

class HumanizerTaskSerializer(serializers.ModelSerializer):
    """Serializer for humanizer task details"""
    task = AITaskSerializer(read_only=True)
    
    class Meta:
        model = HumanizerTask
        fields = ['task', 'writing_style', 'preserve_formatting', 'target_tone']

class TaskStatusSerializer(serializers.ModelSerializer):
    """Lightweight serializer for task status checking"""
    class Meta:
        model = AITask
        fields = ['id', 'status', 'output_text', 'error_message', 'processing_time']

class UserUsageStatsSerializer(serializers.ModelSerializer):
    """Serializer for user usage statistics"""
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = UserUsageStats
        fields = [
            'user', 'humanizer_count', 'paraphraser_count', 'summarizer_count',
            'grammar_checker_count', 'total_tasks', 'total_words_processed',
            'total_chars_processed', 'first_use', 'last_use'
        ]
        read_only_fields = ['user']

class AIToolConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for AI tool configurations"""
    class Meta:
        model = AIToolConfiguration
        fields = [
            'tool_type', 'is_enabled', 'max_input_length', 'rate_limit_per_hour',
            'priority', 'model_name', 'temperature', 'max_tokens'
        ]

class TaskHistorySerializer(serializers.ModelSerializer):
    """Serializer for task history with minimal data"""
    class Meta:
        model = AITask
        fields = [
            'id', 'tool_type', 'status', 'created_at', 'completed_at',
            'input_word_count', 'output_word_count', 'processing_time'
        ]
