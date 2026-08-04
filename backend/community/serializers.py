from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import (
    Group, GroupMembership, GroupMessage, Forum, ForumPost, 
    PostLike, PostReply, PrivateChat, PrivateMessage, UserActivity
)

User = get_user_model()


class OwnEmailOnlyMixin(serializers.Serializer):
    """Expose `email` only to the user it belongs to; null for everyone else."""

    email = serializers.SerializerMethodField()

    def get_email(self, obj):
        request = self.context.get('request')
        viewer = getattr(request, 'user', None)
        if viewer is not None and viewer.is_authenticated and viewer.pk == obj.pk:
            return obj.email
        return None


class UserBasicSerializer(OwnEmailOnlyMixin, serializers.ModelSerializer):
    """Basic user serializer for nested relationships"""
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']
        read_only_fields = ['id', 'username', 'email']


class UserProfileSerializer(OwnEmailOnlyMixin, serializers.ModelSerializer):
    """Extended user serializer with profile information"""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'full_name', 'date_joined']
        read_only_fields = ['id', 'username', 'email', 'date_joined']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class GroupMembershipSerializer(serializers.ModelSerializer):
    """Serializer for group membership information"""
    user = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = GroupMembership
        fields = ['user', 'role', 'is_muted', 'created_at']
        read_only_fields = ['created_at']


class GroupSerializer(serializers.ModelSerializer):
    """Serializer for group model"""
    owner = UserBasicSerializer(read_only=True)
    moderators = UserBasicSerializer(many=True, read_only=True)
    member_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_joined = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    is_moderator = serializers.SerializerMethodField()
    last_activity = serializers.SerializerMethodField()
    members_list = GroupMembershipSerializer(source='groupmembership_set', many=True, read_only=True)
    
    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'category', 'type', 'max_members',
            'is_active', 'course_code', 'professor', 'owner', 'moderators',
            'avatar', 'tags', 'created_at', 'updated_at', 'member_count',
            'is_full', 'is_joined', 'is_owner', 'is_moderator', 'last_activity',
            'members_list'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'owner']
    
    def get_is_joined(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(id=request.user.id).exists()
        return False
    
    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.owner_id == request.user.id
        return False
    
    def get_is_moderator(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.moderators.filter(id=request.user.id).exists()
        return False
    
    def get_last_activity(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            return last_message.created_at
        return obj.updated_at
    
    def validate_tags(self, value):
        """Validate tags are a list of strings"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list")
        
        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError("All tags must be strings")
            if len(tag.strip()) == 0:
                raise serializers.ValidationError("Tags cannot be empty")
        
        return [tag.strip().lower() for tag in value if tag.strip()]


class GroupCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating groups"""
    class Meta:
        model = Group
        fields = [
            'name', 'description', 'category', 'type', 'max_members',
            'course_code', 'professor', 'avatar', 'tags'
        ]
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['owner'] = request.user
        group = super().create(validated_data)
        
        # Automatically add owner as member with owner role
        GroupMembership.objects.create(
            user=request.user,
            group=group,
            role='owner'
        )
        
        return group


class GroupMessageSerializer(serializers.ModelSerializer):
    """Serializer for group messages"""
    sender = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = GroupMessage
        fields = [
            'id', 'content', 'message_type', 'sender', 'file_attachment',
            'image_attachment', 'is_edited', 'edited_at', 'created_at'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'is_edited', 'edited_at']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['sender'] = request.user
        return super().create(validated_data)


class ForumSerializer(serializers.ModelSerializer):
    """Serializer for forum model"""
    moderators = UserBasicSerializer(many=True, read_only=True)
    post_count = serializers.ReadOnlyField()
    member_count = serializers.ReadOnlyField()
    last_post = serializers.SerializerMethodField()
    
    class Meta:
        model = Forum
        fields = [
            'id', 'title', 'description', 'category', 'icon_name', 'color_class',
            'is_active', 'moderators', 'post_count', 'member_count', 'last_post',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_last_post(self, obj):
        last_post = obj.posts.order_by('-created_at').first()
        if last_post:
            return {
                'id': str(last_post.id),
                'title': last_post.title,
                'author': last_post.author.username,
                'timestamp': last_post.created_at.isoformat()
            }
        return None


class PostReplySerializer(serializers.ModelSerializer):
    """Serializer for post replies"""
    author = UserBasicSerializer(read_only=True)
    like_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    # Temporarily removed nested_replies to prevent React error
    # nested_replies = serializers.SerializerMethodField()
    
    class Meta:
        model = PostReply
        fields = [
            'id', 'content', 'author', 'parent_reply', 'like_count',
            'is_liked', 'created_at', 'updated_at'
            # Temporarily removed 'nested_replies' from fields
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False
    
    # Temporarily commented out to prevent recursive serialization issues
    # def get_nested_replies(self, obj):
    #     """Get nested replies (limit to 2 levels deep)"""
    #     if hasattr(obj, '_nested_replies_fetched'):
    #         return obj._nested_replies_fetched
    #     
    #     # Check if we're already in a nested context to prevent infinite recursion
    #     context = self.context or {}
    #     depth = context.get('reply_depth', 0)
    #     
    #     if depth >= 2:  # Limit to 2 levels of nesting
    #         return []
    #     
    #     nested = obj.nested_replies.select_related('author').order_by('created_at')[:5]
    #     
    #     # Create new context with increased depth
    #     nested_context = dict(context)
    #     nested_context['reply_depth'] = depth + 1
    #     
    #     return PostReplySerializer(nested, many=True, context=nested_context).data
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user
        return super().create(validated_data)


class ForumPostSerializer(serializers.ModelSerializer):
    """Serializer for forum posts"""
    author = UserProfileSerializer(read_only=True)
    forum = ForumSerializer(read_only=True)
    like_count = serializers.ReadOnlyField()
    reply_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    # Temporarily removed replies to prevent React rendering issues
    # replies = PostReplySerializer(many=True, read_only=True)
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = ForumPost
        fields = [
            'id', 'title', 'content', 'author', 'forum', 'tags', 'is_pinned',
            'is_locked', 'view_count', 'like_count', 'reply_count', 'is_liked',
            'is_bookmarked', 'timestamp', 'created_at', 'updated_at'
            # Temporarily removed 'replies' from fields
        ]
        read_only_fields = ['id', 'author', 'view_count', 'created_at', 'updated_at']
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_liked_by(request.user)
        return False
    
    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_bookmarked_by(request.user)
        return False
    
    def validate_tags(self, value):
        """Validate tags are a list of strings"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Tags must be a list")
        
        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError("All tags must be strings")
            if len(tag.strip()) == 0:
                raise serializers.ValidationError("Tags cannot be empty")
        
        return [tag.strip().lower() for tag in value if tag.strip()]
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user
        return super().create(validated_data)


class ForumPostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating forum posts"""
    forum_id = serializers.UUIDField(write_only=True)
    
    class Meta:
        model = ForumPost
        fields = ['title', 'content', 'tags', 'forum_id']
    
    def create(self, validated_data):
        request = self.context.get('request')
        forum_id = validated_data.pop('forum_id')
        
        try:
            forum = Forum.objects.get(id=forum_id)
        except Forum.DoesNotExist:
            raise serializers.ValidationError("Forum not found")
        
        validated_data['author'] = request.user
        validated_data['forum'] = forum
        return super().create(validated_data)


class PrivateMessageSerializer(serializers.ModelSerializer):
    """Serializer for private messages"""
    sender = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = PrivateMessage
        fields = [
            'id', 'content', 'message_type', 'sender', 'file_attachment',
            'image_attachment', 'is_read', 'read_at', 'is_edited', 'edited_at',
            'created_at'
        ]
        read_only_fields = [
            'id', 'sender', 'is_read', 'read_at', 'is_edited', 'edited_at', 'created_at'
        ]
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['sender'] = request.user
        return super().create(validated_data)


class PrivateChatSerializer(serializers.ModelSerializer):
    """Serializer for private chats"""
    participants = UserBasicSerializer(many=True, read_only=True)
    last_message = PrivateMessageSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = PrivateChat
        fields = [
            'id', 'name', 'is_group_chat', 'participants', 'last_message',
            'unread_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.private_messages.filter(
                is_read=False
            ).exclude(sender=request.user).count()
        return 0


class PrivateChatCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating private chats"""
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),  # Changed from UUIDField to IntegerField for user IDs
        min_length=1,
        max_length=10,  # Limit group chat size
        write_only=True  # Make this field write-only since it's not part of the model
    )
    
    class Meta:
        model = PrivateChat
        fields = ['id', 'name', 'is_group_chat', 'participant_ids', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_participant_ids(self, value):
        request = self.context.get('request')
        
        # Remove current user from participants (will be added automatically)
        if request and request.user and request.user.id in value:
            value.remove(request.user.id)
        
        # Validate all participants exist
        existing_users = User.objects.filter(id__in=value)
        if existing_users.count() != len(value):
            raise serializers.ValidationError("Some users do not exist")
        
        return value
    
    def create(self, validated_data):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("Authentication required")
            
        participant_ids = validated_data.pop('participant_ids')
        is_group_chat = validated_data.get('is_group_chat', False)
        
        # Generate name for private chats if not provided
        if not validated_data.get('name') and not is_group_chat:
            participants = User.objects.filter(id__in=participant_ids)
            participant_names = [p.get_full_name() or p.username for p in participants]
            current_user_name = request.user.get_full_name() or request.user.username
            
            # Create a meaningful name for the private chat
            if len(participant_names) == 1:
                validated_data['name'] = f"{current_user_name} & {participant_names[0]}"
            else:
                all_names = [current_user_name] + participant_names
                validated_data['name'] = ", ".join(all_names)
        
        # Create chat
        chat = PrivateChat.objects.create(**validated_data)
        
        # Add participants
        participants = User.objects.filter(id__in=participant_ids)
        chat.participants.add(request.user, *participants)
        
        return chat


class UserActivitySerializer(serializers.ModelSerializer):
    """Serializer for user activity tracking"""
    user = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = UserActivity
        fields = [
            'id', 'user', 'activity_type', 'content_type', 'object_id',
            'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']


# Bulk operation serializers
class GroupJoinSerializer(serializers.Serializer):
    """Serializer for joining groups"""
    group_id = serializers.UUIDField()
    
    def validate_group_id(self, value):
        try:
            group = Group.objects.get(id=value)
        except Group.DoesNotExist:
            raise serializers.ValidationError("Group not found")
        
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("Authentication required")
            
        if not group.can_join(request.user):
            raise serializers.ValidationError("Cannot join this group")
        
        return value


class PostLikeSerializer(serializers.Serializer):
    """Serializer for liking/unliking posts"""
    post_id = serializers.UUIDField()
    
    def validate_post_id(self, value):
        try:
            ForumPost.objects.get(id=value)
        except ForumPost.DoesNotExist:
            raise serializers.ValidationError("Post not found")
        return value


class PostBookmarkSerializer(serializers.Serializer):
    """Serializer for bookmarking/unbookmarking posts"""
    post_id = serializers.UUIDField()
    
    def validate_post_id(self, value):
        try:
            ForumPost.objects.get(id=value)
        except ForumPost.DoesNotExist:
            raise serializers.ValidationError("Post not found")
        return value
