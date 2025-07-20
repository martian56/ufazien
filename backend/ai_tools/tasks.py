import time
import logging
import traceback
from typing import Optional
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from django.contrib.auth.models import User
from celery import shared_task
from .models import AITask, HumanizerTask, UserUsageStats, TaskStatus, AIToolType
from .services import AIService

logger = logging.getLogger(__name__)

class TaskManager:
    """Manages AI task processing and queuing"""
    
    @staticmethod
    def create_humanizer_task(user: User, input_text: str, **kwargs) -> AITask:
        """Create a new humanizer task"""
        with transaction.atomic():
            # Create main AI task
            ai_task = AITask.objects.create(
                user=user,
                tool_type=AIToolType.HUMANIZER,
                input_text=input_text,
                parameters=kwargs
            )
            
            # Create humanizer-specific details
            humanizer_task = HumanizerTask.objects.create(
                task=ai_task,
                writing_style=kwargs.get('writing_style', 'natural'),
                preserve_formatting=kwargs.get('preserve_formatting', True),
                target_tone=kwargs.get('target_tone', '')
            )
            
            # Update user stats
            TaskManager._update_user_stats(user, AIToolType.HUMANIZER, len(input_text))
            
            # Queue the task for processing
            process_ai_task.delay(str(ai_task.id))
            
            return ai_task
    
    @staticmethod
    def create_task(user: User, tool_type: str, input_text: str, **kwargs) -> AITask:
        """Create a task for any AI tool"""
        with transaction.atomic():
            ai_task = AITask.objects.create(
                user=user,
                tool_type=tool_type,
                input_text=input_text,
                parameters=kwargs
            )
            
            # Update user stats
            TaskManager._update_user_stats(user, tool_type, len(input_text))
            
            # Queue the task for processing
            process_ai_task.delay(str(ai_task.id))
            
            return ai_task
    
    @staticmethod
    def _update_user_stats(user: User, tool_type: str, char_count: int):
        """Update user usage statistics"""
        stats, created = UserUsageStats.objects.get_or_create(user=user)
        
        # Update tool-specific count
        tool_count_field = f"{tool_type}_count"
        if hasattr(stats, tool_count_field):
            setattr(stats, tool_count_field, getattr(stats, tool_count_field) + 1)
        
        # Update totals
        stats.total_tasks += 1
        stats.total_chars_processed += char_count
        stats.total_words_processed += len(input_text.split()) if 'input_text' in locals() else 0
        
        stats.save()
    
    @staticmethod
    def get_task_status(task_id: str) -> Optional[dict]:
        """Get current status of a task"""
        try:
            task = AITask.objects.get(id=task_id)
            return {
                'id': str(task.id),
                'status': task.status,
                'output_text': task.output_text,
                'error_message': task.error_message,
                'processing_time': task.processing_time,
                'created_at': task.created_at,
                'completed_at': task.completed_at,
                'progress': TaskManager._calculate_progress(task)
            }
        except AITask.DoesNotExist:
            return None
    
    @staticmethod
    def _calculate_progress(task: AITask) -> int:
        """Calculate task progress percentage"""
        if task.status == TaskStatus.COMPLETED:
            return 100
        elif task.status == TaskStatus.PROCESSING:
            # Estimate progress based on time elapsed
            if task.started_at:
                elapsed = (timezone.now() - task.started_at).total_seconds()
                # Estimate 30 seconds average processing time
                progress = min(90, int((elapsed / 30) * 90))
                return progress
            return 10
        elif task.status == TaskStatus.PENDING:
            return 0
        else:  # FAILED or CANCELLED
            return 0
    
    @staticmethod
    def cancel_task(task_id: str, user: User) -> bool:
        """Cancel a pending task"""
        try:
            task = AITask.objects.get(id=task_id, user=user)
            if task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING]:
                task.status = TaskStatus.CANCELLED
                task.completed_at = timezone.now()
                task.save()
                return True
            return False
        except AITask.DoesNotExist:
            return False
    
    @staticmethod
    def get_user_tasks(user: User, limit: int = 50) -> list:
        """Get user's recent tasks"""
        tasks = AITask.objects.filter(user=user).order_by('-created_at')[:limit]
        return [
            {
                'id': str(task.id),
                'tool_type': task.tool_type,
                'status': task.status,
                'created_at': task.created_at,
                'completed_at': task.completed_at,
                'input_word_count': task.input_word_count,
                'output_word_count': task.output_word_count,
                'processing_time': task.processing_time
            }
            for task in tasks
        ]

    @staticmethod
    def check_rate_limit(user: User, tool_type: str) -> bool:
        """Check if user has exceeded rate limit"""
        cache_key = f"rate_limit_{user.id}_{tool_type}"
        current_count = cache.get(cache_key, 0)
        
        # Default rate limit: 100 requests per hour
        rate_limit = 100
        
        if current_count >= rate_limit:
            return False
        
        # Increment counter
        cache.set(cache_key, current_count + 1, 3600)  # 1 hour timeout
        return True

@shared_task(bind=True, max_retries=3)
def process_ai_task(self, task_id: str):
    """Celery task to process AI requests"""
    try:
        # Get the task
        task = AITask.objects.get(id=task_id)
        
        # Check if task is already completed or failed
        if task.status not in [TaskStatus.PENDING, TaskStatus.PROCESSING]:
            logger.info(f"Task {task_id} already processed with status {task.status}")
            return
        
        # Mark as processing
        task.status = TaskStatus.PROCESSING
        task.started_at = timezone.now()
        task.save()
        
        logger.info(f"Starting processing of task {task_id} for user {task.user.username}")
        
        # Process the task
        ai_service = AIService()
        start_time = time.time()
        
        output_text = ai_service.process_task(task)
        
        processing_time = time.time() - start_time
        
        # Update task with results
        task.output_text = output_text
        task.processing_time = processing_time
        task.status = TaskStatus.COMPLETED
        task.completed_at = timezone.now()
        task.save()
        
        logger.info(f"Successfully completed task {task_id} in {processing_time:.2f} seconds")
        
        # Cache the result for quick access
        cache.set(f"task_result_{task_id}", {
            'status': TaskStatus.COMPLETED,
            'output_text': output_text,
            'processing_time': processing_time
        }, timeout=3600)  # Cache for 1 hour
        
    except AITask.DoesNotExist:
        logger.error(f"Task {task_id} not found")
        
    except Exception as e:
        logger.error(f"Error processing task {task_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        try:
            # Mark task as failed
            task = AITask.objects.get(id=task_id)
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            task.completed_at = timezone.now()
            task.save()
            
            # Cache the error
            cache.set(f"task_result_{task_id}", {
                'status': TaskStatus.FAILED,
                'error_message': str(e)
            }, timeout=3600)
            
        except Exception as save_error:
            logger.error(f"Failed to save error state for task {task_id}: {str(save_error)}")
        
        # Retry if retries available
        if self.request.retries < self.max_retries:
            # Wait before retrying (exponential backoff)
            countdown = 2 ** self.request.retries
            logger.info(f"Retrying task {task_id} in {countdown} seconds (attempt {self.request.retries + 1})")
            raise self.retry(countdown=countdown, exc=e)
