from django.shortcuts import render
from django.db.models import Q, Count, F, Prefetch
from django.utils import timezone
from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.core.exceptions import PermissionDenied
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import (
    Group, GroupMembership, GroupMessage, Forum, ForumPost, PostAttachment,
    PostReply, PrivateChat, PrivateMessage, UserActivity
)
from .serializers import (
    PostAttachmentSerializer,
    GroupSerializer, GroupCreateSerializer, GroupMessageSerializer,
    ForumSerializer, ForumPostSerializer, ForumPostCreateSerializer,
    PostReplySerializer, PrivateChatSerializer, PrivateChatCreateSerializer,
    PrivateMessageSerializer, GroupJoinSerializer, PostLikeSerializer,
    PostBookmarkSerializer, UserActivitySerializer
)


# Matches the frontend's own upload guard in utils/security.
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024


class CommunityPermission(permissions.BasePermission):
    """Custom permission class for community features"""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Check ownership or moderation rights
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'author'):
            return obj.author == request.user
        if hasattr(obj, 'sender'):
            return obj.sender == request.user
            
        return False


class GroupViewSet(viewsets.ModelViewSet):
    """ViewSet for managing groups"""
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'type', 'is_active']
    search_fields = ['name', 'description', 'tags', 'course_code']
    ordering_fields = ['created_at', 'name', 'member_count']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = Group.objects.select_related('owner').prefetch_related(
            'moderators', 'members', 
            Prefetch('groupmembership_set', queryset=GroupMembership.objects.select_related('user'))
        )
        
        # Filter by user's groups if requested
        if self.action == 'my_groups':
            return queryset.filter(members=self.request.user)
        
        # For update/delete operations, only allow access to groups user owns or moderates
        if self.action in ['update', 'partial_update', 'destroy']:
            return queryset.filter(
                Q(owner=self.request.user) | Q(moderators=self.request.user)
            ).distinct()
        
        # Only show active public groups by default, or groups user is member of
        if not self.request.user.is_staff:
            queryset = queryset.filter(
                Q(is_active=True) & 
                (Q(type='public') | Q(members=self.request.user))
            ).distinct()
        
        return queryset
    
    def get_object(self):
        """
        Override get_object to ensure user can only access groups they own or moderate for update/delete operations
        """
        obj = super().get_object()

        # Safe methods are open to anyone who can see the group.
        if self.request.method in permissions.SAFE_METHODS:
            return obj

        # join and leave are POSTs, but they change the caller's membership,
        # not the group itself. Gating them on ownership meant nobody could
        # join a group they did not already own.
        if self.action in {'join', 'leave'}:
            return obj

        # Everything else that writes (PUT, PATCH, DELETE) needs ownership or
        # moderation rights.
        if not (obj.owner == self.request.user or obj.moderators.filter(id=self.request.user.id).exists()):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only modify groups you own or moderate.")

        return obj
    
    def get_serializer_class(self):
        if self.action == 'create':
            return GroupCreateSerializer
        return GroupSerializer

    def create(self, request, *args, **kwargs):
        """Return the full group after creating it.

        GroupCreateSerializer omits id, so the client had no way to reference
        the group it had just made without refetching the whole list.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = GroupSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Create group and add creator as owner member"""
        group = serializer.save()
        
        # Track activity
        UserActivity.objects.create(
            user=self.request.user,
            activity_type='group_create',
            content_type='group',
            object_id=group.id,
            metadata={'group_name': group.name}
        )
    
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a group"""
        print(f"User {request.user} trying to join group {pk}")
        group = self.get_object()
        print(f"Group found: {group.name}, type: {group.type}, is_full: {group.is_full}")
        
        # Check if user is already a member
        is_member = group.members.filter(id=request.user.id).exists()
        print(f"User is already member: {is_member}")
        
        if is_member:
            return Response(
                {'error': 'Already a member of this group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if group is full
        if group.is_full:
            print(f"Group is full: {group.member_count}/{group.max_members}")
            return Response(
                {'error': 'Group is full'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if group is private
        if group.type == 'private':
            print(f"Group is private, cannot join without invitation")
            return Response(
                {'error': 'Cannot join private group without invitation'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add user to group
        membership, created = GroupMembership.objects.get_or_create(
            user=request.user,
            group=group,
            defaults={'role': 'member'}
        )
        
        if not created:
            return Response(
                {'error': 'Membership already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Track activity
        UserActivity.objects.create(
            user=request.user,
            activity_type='group_join',
            content_type='group',
            object_id=group.id,
            metadata={'group_name': group.name}
        )
        
        # Send notification to group members
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'group_chat_{group.id}',
            {
                'type': 'user_joined',
                'user_id': str(request.user.id),
                'username': request.user.username,
                'timestamp': timezone.now().isoformat()
            }
        )
        
        serializer = self.get_serializer(group)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a group"""
        group = self.get_object()
        
        try:
            membership = GroupMembership.objects.get(user=request.user, group=group)
        except GroupMembership.DoesNotExist:
            return Response(
                {'error': 'Not a member of this group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prevent owner from leaving
        if membership.role == 'owner':
            return Response(
                {'error': 'Group owner cannot leave the group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        membership.delete()
        
        # Track activity
        UserActivity.objects.create(
            user=request.user,
            activity_type='group_leave',
            content_type='group',
            object_id=group.id,
            metadata={'group_name': group.name}
        )
        
        # Send notification to group members
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'group_chat_{group.id}',
            {
                'type': 'user_left',
                'user_id': str(request.user.id),
                'username': request.user.username,
                'timestamp': timezone.now().isoformat()
            }
        )
        
        serializer = self.get_serializer(group)
        return Response(serializer.data)
    
    @action(detail=False)
    def my_groups(self, request):
        """Get user's joined groups"""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True)
    def messages(self, request, pk=None):
        """Get group messages"""
        group = self.get_object()
        
        # Check if user is member
        if not group.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You must be a member to view messages")
        
        messages = GroupMessage.objects.filter(group=group).select_related('sender').order_by('-created_at')
        page = self.paginate_queryset(messages)
        if page is not None:
            serializer = GroupMessageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = GroupMessageSerializer(messages, many=True)
        return Response(serializer.data)


class ForumViewSet(viewsets.ModelViewSet):
    """ViewSet for managing forums"""
    queryset = Forum.objects.filter(is_active=True).prefetch_related('moderators')
    serializer_class = ForumSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description']
    ordering_fields = ['title', 'created_at']
    ordering = ['title']
    
    def get_permissions(self):
        """Only staff can create/update/delete forums"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=True)
    def posts(self, request, pk=None):
        """Get posts in a forum"""
        forum = self.get_object()
        posts = ForumPost.objects.filter(forum=forum).select_related('author').prefetch_related('likes', 'bookmarks').order_by('-is_pinned', '-created_at')
        
        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = ForumPostSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = ForumPostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)


class ForumPostViewSet(viewsets.ModelViewSet):
    """ViewSet for managing forum posts"""
    serializer_class = ForumPostSerializer
    permission_classes = [CommunityPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['forum', 'author', 'is_pinned']
    search_fields = ['title', 'content', 'tags']
    ordering_fields = ['created_at', 'view_count', 'like_count']
    ordering = ['-is_pinned', '-created_at']
    
    def get_queryset(self):
        return ForumPost.objects.select_related('author', 'forum').prefetch_related(
            'likes', 'bookmarks',
            Prefetch('replies', queryset=PostReply.objects.select_related('author').order_by('created_at'))
        )
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ForumPostCreateSerializer
        return ForumPostSerializer

    def create(self, request, *args, **kwargs):
        """Return the full post after creating it.

        ForumPostCreateSerializer only declares title/content/tags/forum_id, so
        responding with it gave the client no id and no author, leaving the UI
        unable to open, like or update the post it had just created.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = ForumPostSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def retrieve(self, request, *args, **kwargs):
        """Increment view count when post is viewed"""
        instance = self.get_object()
        instance.view_count += 1
        instance.save(update_fields=['view_count'])
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """Create post and track activity"""
        post = serializer.save()
        
        # Track activity
        UserActivity.objects.create(
            user=self.request.user,
            activity_type='post_create',
            content_type='post',
            object_id=post.id,
            metadata={'post_title': post.title, 'forum_name': post.forum.title}
        )
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def attachments(self, request, pk=None):
        """Attach an image to a post.

        Only the author may add one, matching who may edit the post.
        """
        post = self.get_object()

        if post.author != request.user:
            return Response(
                {'error': 'You can only add images to your own post.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'An image file is required.'}, status=status.HTTP_400_BAD_REQUEST
            )

        if image.size > MAX_ATTACHMENT_BYTES:
            return Response(
                {'error': 'Images must be 5MB or smaller.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachment = PostAttachment.objects.create(
            post=post,
            image=image,
            caption=request.data.get('caption', '')[:200],
            position=post.attachments.count(),
        )
        return Response(
            PostAttachmentSerializer(attachment, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like or unlike a post"""
        post = self.get_object()
        
        if post.likes.filter(id=request.user.id).exists():
            # Unlike
            post.likes.remove(request.user)
            liked = False
        else:
            # Like
            post.likes.add(request.user)
            liked = True
            
            # Track activity
            UserActivity.objects.create(
                user=request.user,
                activity_type='post_like',
                content_type='post',
                object_id=post.id,
                metadata={'post_title': post.title}
            )
        
        return Response({
            'liked': liked,
            'like_count': post.like_count
        })
    
    @action(detail=True, methods=['post'])
    def bookmark(self, request, pk=None):
        """Bookmark or unbookmark a post"""
        post = self.get_object()
        
        if post.bookmarks.filter(id=request.user.id).exists():
            # Remove bookmark
            post.bookmarks.remove(request.user)
            bookmarked = False
        else:
            # Add bookmark
            post.bookmarks.add(request.user)
            bookmarked = True
        
        return Response({
            'bookmarked': bookmarked
        })
    
    @action(detail=True)
    def replies(self, request, pk=None):
        """Get post replies"""
        post = self.get_object()
        replies = PostReply.objects.filter(post=post, parent_reply=None).select_related('author').prefetch_related('likes', 'nested_replies__author').order_by('created_at')
        
        page = self.paginate_queryset(replies)
        if page is not None:
            serializer = PostReplySerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = PostReplySerializer(replies, many=True, context={'request': request})
        return Response(serializer.data)


class PostReplyViewSet(viewsets.ModelViewSet):
    """ViewSet for managing post replies"""
    serializer_class = PostReplySerializer
    permission_classes = [CommunityPermission]
    
    def get_queryset(self):
        return PostReply.objects.select_related('author', 'post', 'parent_reply').prefetch_related('likes')
    
    def perform_create(self, serializer):
        """Create reply and track activity"""
        reply = serializer.save()
        
        # Track activity
        UserActivity.objects.create(
            user=self.request.user,
            activity_type='post_reply',
            content_type='reply',
            object_id=reply.id,
            metadata={'post_title': reply.post.title}
        )
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like or unlike a reply"""
        reply = self.get_object()
        
        if reply.likes.filter(id=request.user.id).exists():
            # Unlike
            reply.likes.remove(request.user)
            liked = False
        else:
            # Like
            reply.likes.add(request.user)
            liked = True
        
        return Response({
            'liked': liked,
            'like_count': reply.like_count
        })


class PrivateChatViewSet(viewsets.ModelViewSet):
    """ViewSet for managing private chats"""
    serializer_class = PrivateChatSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return PrivateChat.objects.filter(participants=self.request.user).prefetch_related('participants').order_by('-updated_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PrivateChatCreateSerializer
        return PrivateChatSerializer
    
    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        """Get chat messages (GET) or send a message (POST)"""
        chat = self.get_object()
        
        if request.method == 'GET':
            # Retrieve messages
            messages = PrivateMessage.objects.filter(chat=chat).select_related('sender').order_by('-created_at')
            
            page = self.paginate_queryset(messages)
            if page is not None:
                serializer = PrivateMessageSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            
            serializer = PrivateMessageSerializer(messages, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Send a new message
            serializer = PrivateMessageSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                message = serializer.save(chat=chat)
                
                # Track activity
                UserActivity.objects.create(
                    user=request.user,
                    activity_type='private_message',
                    content_type='message',
                    object_id=message.id,
                    metadata={'chat_name': str(chat)}
                )
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark all messages in chat as read"""
        chat = self.get_object()
        
        # Mark unread messages as read
        updated_count = PrivateMessage.objects.filter(
            chat=chat,
            is_read=False
        ).exclude(sender=request.user).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({'messages_marked_read': updated_count})


class UserActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing user activity"""
    serializer_class = UserActivitySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['activity_type', 'content_type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        return UserActivity.objects.filter(user=self.request.user).select_related('user')


# Additional API views for statistics and recommendations
from rest_framework.views import APIView

class CommunityStatsView(APIView):
    """Get community statistics for dashboard"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get user's community stats
        stats = {
            'groups_joined': Group.objects.filter(members=user).count(),
            'groups_owned': Group.objects.filter(owner=user).count(),
            'posts_created': ForumPost.objects.filter(author=user).count(),
            'posts_liked': ForumPost.objects.filter(likes=user).count(),
            'posts_bookmarked': ForumPost.objects.filter(bookmarks=user).count(),
            'replies_created': PostReply.objects.filter(author=user).count(),
            'messages_sent': GroupMessage.objects.filter(sender=user).count(),
            'recent_activity': UserActivity.objects.filter(user=user).count()
        }
        
        # Get community-wide stats
        community_stats = {
            'total_groups': Group.objects.filter(is_active=True).count(),
            'total_forums': Forum.objects.filter(is_active=True).count(),
            'total_posts': ForumPost.objects.count(),
            'total_members': Group.objects.aggregate(
                total=Count('members', distinct=True)
            )['total'] or 0
        }
        
        return Response({
            'user_stats': stats,
            'community_stats': community_stats
        })


class RecommendedGroupsView(APIView):
    """Get recommended groups for user"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get user's joined groups to find similar interests
        user_groups = Group.objects.filter(members=user)
        user_categories = user_groups.values_list('category', flat=True)
        user_tags = []
        for group in user_groups:
            user_tags.extend(group.tags)
        
        # is_full and member_count are Python properties, not columns, so they
        # cannot be used in exclude()/annotate(). Count members in the query and
        # compare against max_members instead.
        recommended = Group.objects.filter(
            is_active=True,
            type='public'
        ).exclude(
            members=user
        ).annotate(
            num_members=Count('members', distinct=True)
        ).filter(
            num_members__lt=F('max_members')
        )

        if user_categories:
            recommended = recommended.filter(category__in=list(user_categories))

        # Order by relevance and limit results
        recommended = recommended.order_by('-num_members')[:10]
        
        serializer = GroupSerializer(recommended, many=True, context={'request': request})
        return Response(serializer.data)
