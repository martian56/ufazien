from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()

class AIToolType(models.TextChoices):
    """Available AI tool types"""
    HUMANIZER = 'humanizer', 'Text Humanizer'
    PARAPHRASER = 'paraphraser', 'AI Paraphraser'
    SUMMARIZER = 'summarizer', 'Text Summarizer'
    GRAMMAR_CHECKER = 'grammar_checker', 'Grammar Assistant'

class TaskStatus(models.TextChoices):
    """Task processing status"""
    PENDING = 'pending', 'Pending'
    PROCESSING = 'processing', 'Processing'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'
    CANCELLED = 'cancelled', 'Cancelled'

class WritingStyle(models.TextChoices):
    """Writing styles for humanizer"""
    NATURAL = 'natural', 'Natural'
    ACADEMIC = 'academic', 'Academic'
    CASUAL = 'casual', 'Casual'
    PROFESSIONAL = 'professional', 'Professional'
    CREATIVE = 'creative', 'Creative'

class AITask(models.Model):
    """Main task model for AI processing"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_tasks')
    tool_type = models.CharField(choices=AIToolType.choices, max_length=20)
    status = models.CharField(choices=TaskStatus.choices, max_length=15, default=TaskStatus.PENDING)
    
    # Input data
    input_text = models.TextField()
    parameters = models.JSONField(default=dict, blank=True)  # Tool-specific parameters
    
    # Output data
    output_text = models.TextField(blank=True, null=True)
    processing_time = models.FloatField(null=True, blank=True)  # in seconds
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    # Statistics
    input_word_count = models.IntegerField(default=0)
    input_char_count = models.IntegerField(default=0)
    output_word_count = models.IntegerField(default=0)
    output_char_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'tool_type']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.tool_type} - {self.status}"

    def save(self, *args, **kwargs):
        # Calculate word and character counts
        if self.input_text:
            self.input_word_count = len(self.input_text.split())
            self.input_char_count = len(self.input_text)
        
        if self.output_text:
            self.output_word_count = len(self.output_text.split())
            self.output_char_count = len(self.output_text)
        
        super().save(*args, **kwargs)

    @property
    def is_processing(self):
        return self.status in [TaskStatus.PENDING, TaskStatus.PROCESSING]

    @property
    def duration(self):
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

class HumanizerTask(models.Model):
    """Specific model for humanizer tasks"""
    task = models.OneToOneField(AITask, on_delete=models.CASCADE, related_name='humanizer_details')
    writing_style = models.CharField(choices=WritingStyle.choices, max_length=15, default=WritingStyle.NATURAL)
    preserve_formatting = models.BooleanField(default=True)
    target_tone = models.CharField(max_length=50, blank=True)
    
    class Meta:
        verbose_name = "Humanizer Task"
        verbose_name_plural = "Humanizer Tasks"

class UserUsageStats(models.Model):
    """Track user usage statistics"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='ai_usage_stats')
    
    # Usage counts by tool
    humanizer_count = models.IntegerField(default=0)
    paraphraser_count = models.IntegerField(default=0)
    summarizer_count = models.IntegerField(default=0)
    grammar_checker_count = models.IntegerField(default=0)
    
    # Total statistics
    total_tasks = models.IntegerField(default=0)
    total_words_processed = models.IntegerField(default=0)
    total_chars_processed = models.IntegerField(default=0)
    
    # Time tracking
    first_use = models.DateTimeField(auto_now_add=True)
    last_use = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Usage Stats"
        verbose_name_plural = "User Usage Stats"

    def __str__(self):
        return f"{self.user.username} - {self.total_tasks} tasks"

class AIToolConfiguration(models.Model):
    """Configuration settings for AI tools"""
    tool_type = models.CharField(choices=AIToolType.choices, max_length=20, unique=True)
    is_enabled = models.BooleanField(default=True)
    max_input_length = models.IntegerField(default=10000)  # characters
    rate_limit_per_hour = models.IntegerField(default=100)  # requests per hour per user
    priority = models.IntegerField(default=1)  # processing priority
    
    # AI model settings
    model_name = models.CharField(max_length=100, default='gpt-4o-mini')
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=4000)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "AI Tool Configuration"
        verbose_name_plural = "AI Tool Configurations"

    def __str__(self):
        return f"{self.tool_type} - {'Enabled' if self.is_enabled else 'Disabled'}"
