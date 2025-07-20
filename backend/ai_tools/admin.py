from django.contrib import admin
from django.utils.html import format_html
from .models import (
    AITask, HumanizerTask, UserUsageStats, AIToolConfiguration
)

@admin.register(AITask)
class AITaskAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'tool_type', 'status', 'created_at', 'processing_time_display']
    list_filter = ['tool_type', 'status', 'created_at']
    search_fields = ['user__username', 'user__email', 'id']
    readonly_fields = ['id', 'created_at', 'started_at', 'completed_at', 'duration']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'user', 'tool_type', 'status')
        }),
        ('Content', {
            'fields': ('input_text', 'output_text', 'parameters')
        }),
        ('Statistics', {
            'fields': ('input_word_count', 'input_char_count', 'output_word_count', 'output_char_count')
        }),
        ('Timing', {
            'fields': ('created_at', 'started_at', 'completed_at', 'processing_time', 'duration')
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        })
    )
    
    def processing_time_display(self, obj):
        if obj.processing_time:
            return f"{obj.processing_time:.2f}s"
        return "-"
    processing_time_display.short_description = "Processing Time"

@admin.register(HumanizerTask)
class HumanizerTaskAdmin(admin.ModelAdmin):
    list_display = ['task_id', 'writing_style', 'preserve_formatting', 'task_status']
    list_filter = ['writing_style', 'preserve_formatting']
    search_fields = ['task__id', 'task__user__username']
    
    def task_id(self, obj):
        return str(obj.task.id)[:8]
    task_id.short_description = "Task ID"
    
    def task_status(self, obj):
        status = obj.task.status
        colors = {
            'pending': 'orange',
            'processing': 'blue',
            'completed': 'green',
            'failed': 'red',
            'cancelled': 'gray'
        }
        return format_html(
            '<span style="color: {};">{}</span>',
            colors.get(status, 'black'),
            status.title()
        )
    task_status.short_description = "Status"

@admin.register(UserUsageStats)
class UserUsageStatsAdmin(admin.ModelAdmin):
    list_display = ['user', 'total_tasks', 'total_words_processed', 'last_use']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['first_use', 'last_use']
    ordering = ['-total_tasks']
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Tool Usage', {
            'fields': ('humanizer_count', 'paraphraser_count', 'summarizer_count', 'grammar_checker_count')
        }),
        ('Totals', {
            'fields': ('total_tasks', 'total_words_processed', 'total_chars_processed')
        }),
        ('Timestamps', {
            'fields': ('first_use', 'last_use')
        })
    )

@admin.register(AIToolConfiguration)
class AIToolConfigurationAdmin(admin.ModelAdmin):
    list_display = ['tool_type', 'is_enabled', 'max_input_length', 'rate_limit_per_hour', 'priority']
    list_filter = ['is_enabled', 'tool_type']
    ordering = ['priority', 'tool_type']
    
    fieldsets = (
        ('Basic Settings', {
            'fields': ('tool_type', 'is_enabled', 'priority')
        }),
        ('Limits', {
            'fields': ('max_input_length', 'rate_limit_per_hour')
        }),
        ('AI Model Settings', {
            'fields': ('model_name', 'temperature', 'max_tokens')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ['created_at', 'updated_at']
