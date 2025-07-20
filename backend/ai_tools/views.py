import logging
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q
from django.core.cache import cache
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from datetime import timedelta

from .models import (
    AITask, HumanizerTask, UserUsageStats, AIToolConfiguration,
    AIToolType, TaskStatus
)
from .serializers import (
    AITaskSerializer, HumanizerTaskCreateSerializer, HumanizerTaskSerializer,
    TaskStatusSerializer, UserUsageStatsSerializer, TaskHistorySerializer
)
from .tasks import TaskManager

logger = logging.getLogger(__name__)

class TaskPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_tools_status(request):
    """Get AI tools service status and user stats"""
    try:
        user_stats, created = UserUsageStats.objects.get_or_create(user=request.user)
        
        # Get tool configurations
        tool_configs = AIToolConfiguration.objects.all()
        tools_status = {}
        
        for config in tool_configs:
            tools_status[config.tool_type] = {
                'enabled': config.is_enabled,
                'max_input_length': config.max_input_length,
                'rate_limit_per_hour': config.rate_limit_per_hour
            }
        
        # Default configurations for tools without specific config
        default_tools = ['humanizer', 'paraphraser', 'summarizer', 'grammar_checker']
        for tool in default_tools:
            if tool not in tools_status:
                tools_status[tool] = {
                    'enabled': True,
                    'max_input_length': 10000,
                    'rate_limit_per_hour': 100
                }
        
        return Response({
            'status': 'active',
            'user_stats': UserUsageStatsSerializer(user_stats).data,
            'tools': tools_status,
            'active_tasks': AITask.objects.filter(
                user=request.user,
                status__in=[TaskStatus.PENDING, TaskStatus.PROCESSING]
            ).count()
        })
        
    except Exception as e:
        logger.error(f"Error getting AI tools status: {str(e)}")
        return Response(
            {'error': 'Failed to get service status'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def humanize_text(request):
    """Create a new text humanization task"""
    try:
        # Check rate limit
        if not TaskManager.check_rate_limit(request.user, 'humanizer'):
            return Response(
                {'error': 'Rate limit exceeded. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Validate input
        serializer = HumanizerTaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        validated_data = serializer.validated_data
        input_text = validated_data.pop('input_text')
        
        # Create task
        task = TaskManager.create_humanizer_task(
            user=request.user,
            input_text=input_text,
            **validated_data
        )
        
        return Response({
            'task_id': str(task.id),
            'status': task.status,
            'message': 'Task created successfully. Processing will begin shortly.',
            'estimated_completion': '30-60 seconds'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating humanizer task: {str(e)}")
        return Response(
            {'error': 'Failed to create task. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_text(request):
    """Generic endpoint for processing text with different AI tools"""
    try:
        tool_type = request.data.get('tool_type')
        input_text = request.data.get('input_text')
        
        if not tool_type or not input_text:
            return Response(
                {'error': 'tool_type and input_text are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if tool_type not in [choice[0] for choice in AIToolType.choices]:
            return Response(
                {'error': 'Invalid tool type'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check rate limit
        if not TaskManager.check_rate_limit(request.user, tool_type):
            return Response(
                {'error': 'Rate limit exceeded. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Validate input length
        if len(input_text) > 10000:
            return Response(
                {'error': 'Input text too long. Maximum 10,000 characters allowed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(input_text.strip()) == 0:
            return Response(
                {'error': 'Input text cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create task
        task = TaskManager.create_task(
            user=request.user,
            tool_type=tool_type,
            input_text=input_text.strip(),
            **{k: v for k, v in request.data.items() if k not in ['tool_type', 'input_text']}
        )
        
        return Response({
            'task_id': str(task.id),
            'status': task.status,
            'message': 'Task created successfully. Processing will begin shortly.',
            'estimated_completion': '30-60 seconds'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        return Response(
            {'error': 'Failed to create task. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_status(request, task_id):
    """Get status of a specific task"""
    try:
        # First check cache for quick response
        cached_result = cache.get(f"task_result_{task_id}")
        if cached_result:
            return Response(cached_result)
        
        # Get from database
        task_data = TaskManager.get_task_status(task_id)
        if not task_data:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify user owns this task
        try:
            task = AITask.objects.get(id=task_id, user=request.user)
        except AITask.DoesNotExist:
            return Response(
                {'error': 'Task not found or access denied'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(task_data)
        
    except Exception as e:
        logger.error(f"Error getting task status: {str(e)}")
        return Response(
            {'error': 'Failed to get task status'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_task(request, task_id):
    """Cancel a pending or processing task"""
    try:
        success = TaskManager.cancel_task(task_id, request.user)
        if success:
            return Response({'message': 'Task cancelled successfully'})
        else:
            return Response(
                {'error': 'Task not found or cannot be cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except Exception as e:
        logger.error(f"Error cancelling task: {str(e)}")
        return Response(
            {'error': 'Failed to cancel task'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_history(request):
    """Get user's task history"""
    try:
        # Get query parameters
        tool_type = request.GET.get('tool_type', 'all')
        limit = min(int(request.GET.get('limit', 50)), 100)
        
        # Build queryset
        queryset = AITask.objects.filter(user=request.user)
        
        if tool_type != 'all':
            queryset = queryset.filter(tool_type=tool_type)
        
        # Apply pagination
        paginator = TaskPagination()
        queryset = queryset.order_by('-created_at')
        page = paginator.paginate_queryset(queryset, request)
        
        if page is not None:
            serializer = TaskHistorySerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        # Fallback without pagination
        tasks = queryset[:limit]
        serializer = TaskHistorySerializer(tasks, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error getting task history: {str(e)}")
        return Response(
            {'error': 'Failed to get task history'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    """Get detailed user usage statistics"""
    try:
        user_stats, created = UserUsageStats.objects.get_or_create(user=request.user)
        
        # Get recent activity
        recent_tasks = AITask.objects.filter(
            user=request.user,
            created_at__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        # Get success rate
        total_tasks = AITask.objects.filter(user=request.user).count()
        successful_tasks = AITask.objects.filter(
            user=request.user,
            status=TaskStatus.COMPLETED
        ).count()
        
        success_rate = (successful_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Get average processing time
        completed_tasks = AITask.objects.filter(
            user=request.user,
            status=TaskStatus.COMPLETED,
            processing_time__isnull=False
        )
        
        avg_processing_time = 0
        if completed_tasks.exists():
            total_time = sum(task.processing_time for task in completed_tasks)
            avg_processing_time = total_time / completed_tasks.count()
        
        return Response({
            **UserUsageStatsSerializer(user_stats).data,
            'recent_activity': recent_tasks,
            'success_rate': round(success_rate, 1),
            'avg_processing_time': round(avg_processing_time, 2),
            'total_completed': successful_tasks,
            'total_tasks': total_tasks
        })
        
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        return Response(
            {'error': 'Failed to get user statistics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_detail(request, task_id):
    """Get detailed information about a specific task"""
    try:
        task = get_object_or_404(AITask, id=task_id, user=request.user)
        serializer = AITaskSerializer(task)
        
        response_data = serializer.data
        
        # Add tool-specific details
        if task.tool_type == AIToolType.HUMANIZER:
            try:
                humanizer_details = HumanizerTaskSerializer(task.humanizer_details).data
                response_data['tool_details'] = humanizer_details
            except:
                pass
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting task detail: {str(e)}")
        return Response(
            {'error': 'Failed to get task details'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
