from rest_framework import serializers
from django.contrib.auth import get_user_model

from users.serializers import UserSerializer
from .models import Category, Tag, BlogPost, BlogPostLike, BlogPostBookmark, Comment

User = get_user_model()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']

class TagSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)  # For trending tags with annotation
    
    class Meta:
        model = Tag
        fields = ['id', 'name', 'post_count']

class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id',
            'post',
            'author',
            'content',
            'published_at',
            'parent',
            'replies',
            'likes_count',
            'is_liked'
        ]

    def get_replies(self, obj):
        # List of serialized replies (threaded comments)
        replies = obj.replies.all()
        return CommentSerializer(replies, many=True, context=self.context).data

    def get_likes_count(self, obj):
        return obj.commentlike_set.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.commentlike_set.filter(user=request.user).exists()
        return False

class BlogPostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    category_name = serializers.CharField(source='category.name', read_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    tags = serializers.SerializerMethodField()
    published_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    comments = serializers.SerializerMethodField()
    views = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    featured_image_url = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = [
            'id',
            'title',
            'content',
            'excerpt',
            'featured_image',
            'featured_image_url',
            'author',
            'category',       # accepts category id on POST/PUT
            'category_name',  # shows category name on GET
            'tag_names',      # accepts tag names on POST/PUT
            'tags',           # list of tag names on GET
            'published_at',
            'updated_at',
            'read_time',
            'likes_count',
            'comments',
            'views',
            'is_liked',
            'is_bookmarked',
            'is_published',
            'is_featured'
        ]

    def get_featured_image_url(self, obj):
        if obj.featured_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.featured_image.url)
        return None

    def get_tags(self, obj):
        return [tag.name for tag in obj.tags.all()]

    def get_comments(self, obj):
        # Only return top-level comments (parent=None)
        top_level_comments = obj.comments.filter(parent=None)
        return CommentSerializer(top_level_comments, many=True, context=self.context).data

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return BlogPostLike.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return BlogPostBookmark.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_likes_count(self, obj):
        return obj.likes.count()

    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', [])
        post = BlogPost.objects.create(**validated_data)
        for tag_name in tag_names:
            tag, created = Tag.objects.get_or_create(name=tag_name)
            post.tags.add(tag)
        return post

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            tags = []
            for tag_name in tag_names:
                tag, created = Tag.objects.get_or_create(name=tag_name)
                tags.append(tag)
            instance.tags.set(tags)
        return instance