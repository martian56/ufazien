from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import generics, permissions, status, filters
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from .models import (
    BlogPost, BlogPostLike, BlogPostBookmark, BlogPostView, Tag, Category, Comment, CommentLike
)
from .serializers import (
    BlogPostSerializer, CategorySerializer, TagSerializer, CommentSerializer,
)
from .security import SecurityUtils, rate_limiter

User = get_user_model()

# Custom pagination class
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20  # Match frontend assumption
    page_size_query_param = "page_size"
    max_page_size = 100
    
    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'page_size': self.get_page_size(self.request),  # Use actual requested page size
            'results': data
        })

# List & create blog posts with pagination, filtering & search
class BlogPostApiView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BlogPostSerializer
    queryset = BlogPost.objects.select_related('author', 'category').prefetch_related('tags', 'comments').all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'content', 'tags__name', 'category__name', 'author__username', 'author__first_name', 'author__last_name']
    ordering_fields = ['published_at', 'read_time', 'views']

    def get_queryset(self):
        queryset = super().get_queryset()

        # is_published was never filtered, so an unfinished post was served to
        # everyone exactly like a published one. That made a draft impossible:
        # saving one published it. A draft is visible only to its author.
        user = self.request.user
        status_filter = self.request.query_params.get("status")

        if status_filter == "draft":
            queryset = queryset.filter(is_published=False, author=user)
        else:
            queryset = queryset.filter(Q(is_published=True) | Q(author=user))

        category = self.request.query_params.get("category")
        tag = self.request.query_params.get("tag")
        by = self.request.query_params.get("by")
        if category:
            queryset = queryset.filter(category__name__iexact=category)
        if tag:
            queryset = queryset.filter(tags__name__iexact=tag)
        if by:
            queryset = queryset.filter(author__id=by)
        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        # Rate limiting check
        user_id = str(request.user.id) if request.user.is_authenticated else request.META.get('REMOTE_ADDR', 'unknown')
        if not rate_limiter.is_allowed(f"blog_create_{user_id}", max_requests=5, window_seconds=300):  # 5 posts per 5 minutes
            return Response(
                {"error": "Rate limit exceeded. Please wait before creating another post."}, 
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Sanitize input data
        data = request.data.copy()
        
        try:
            # Sanitize title
            if 'title' in data:
                data['title'] = SecurityUtils.sanitize_text_input(data['title'], max_length=200)
                if not data['title']:
                    return Response({"error": "Title is required and cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Sanitize content
            if 'content' in data:
                # print(f"🔍 Backend received content: {data['content'][:200]}...")
                data['content'] = SecurityUtils.sanitize_html_content(data['content'])
                # print(f"🔍 Backend sanitized content: {data['content'][:200]}...")
                if not data['content']:
                    return Response({"error": "Content is required and cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Sanitize excerpt
            if 'excerpt' in data:
                data['excerpt'] = SecurityUtils.sanitize_text_input(data['excerpt'], max_length=300)
            
            # Validate tag names
            if 'tag_names' in data and isinstance(data['tag_names'], list):
                sanitized_tags = []
                for tag in data['tag_names']:
                    sanitized_tag = SecurityUtils.sanitize_text_input(str(tag), max_length=50)
                    if sanitized_tag:
                        sanitized_tags.append(sanitized_tag)
                data['tag_names'] = sanitized_tags[:10]  # Limit to 10 tags
            
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = BlogPostSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Retrieve, update, delete a single blog post
class BlogPostDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BlogPostSerializer
    queryset = BlogPost.objects.select_related('author', 'category').prefetch_related('tags', 'comments')
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Someone else's draft should 404, not merely be absent from lists."""
        return super().get_queryset().filter(
            Q(is_published=True) | Q(author=self.request.user)
        )

    def get_serializer_context(self):
        return {'request': self.request}

    def get_object(self):
        """
        Override get_object to ensure user can only access their own posts for update/delete operations
        """
        obj = super().get_object()
        
        # For safe methods (GET), allow access to any post
        if self.request.method in permissions.SAFE_METHODS:
            return obj
        
        # For unsafe methods (PUT, PATCH, DELETE), check ownership
        if obj.author != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only modify your own blog posts.")
        
        return obj

    def perform_update(self, serializer):
        # Sanitize input data for updates
        data = self.request.data.copy()
        
        try:
            # Sanitize title
            if 'title' in data:
                data['title'] = SecurityUtils.sanitize_text_input(data['title'], max_length=200)
            
            # Sanitize content
            if 'content' in data:
                data['content'] = SecurityUtils.sanitize_html_content(data['content'])
            
            # Sanitize excerpt
            if 'excerpt' in data:
                data['excerpt'] = SecurityUtils.sanitize_text_input(data['excerpt'], max_length=300)
            
        except ValidationError as e:
            raise ValidationError(str(e))
        
        # Don't change the author - keep the original author
        serializer.save()

# Toggle like on a post
class ToggleLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(BlogPost, id=post_id)
        like, created = BlogPostLike.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            return Response({'liked': False}, status=status.HTTP_200_OK)
        return Response({'liked': True}, status=status.HTTP_201_CREATED)

# Toggle bookmark on a post
class ToggleBookmarkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(BlogPost, id=post_id)
        bookmark, created = BlogPostBookmark.objects.get_or_create(user=request.user, post=post)
        if not created:
            bookmark.delete()
            return Response({'bookmarked': False}, status=status.HTTP_200_OK)
        return Response({'bookmarked': True}, status=status.HTTP_201_CREATED)

    def get(self, request, user_id=None):
        user = request.user if user_id in [None, "me"] else get_object_or_404(User, pk=user_id)
        
        # Get queryset of bookmarked posts (use QuerySet for better performance)
        bookmarked_posts = BlogPost.objects.filter(
            id__in=BlogPostBookmark.objects.filter(user=user).values_list('post_id', flat=True)
        ).select_related('author', 'category').prefetch_related('tags', 'comments')
        
        # Apply search filter if provided
        search_query = request.query_params.get('search')
        if search_query:
            from django.db.models import Q
            bookmarked_posts = bookmarked_posts.filter(
                Q(title__icontains=search_query) |
                Q(content__icontains=search_query) |
                Q(author__username__icontains=search_query) |
                Q(author__first_name__icontains=search_query) |
                Q(author__last_name__icontains=search_query) |
                Q(tags__name__icontains=search_query) |
                Q(category__name__icontains=search_query)
            ).distinct()
        
        # Order by most recent first
        bookmarked_posts = bookmarked_posts.order_by('-published_at')
        
        # Paginate using the standard paginator
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(bookmarked_posts, request)
        serializer = BlogPostSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

# Track view on a post (increment view count once per user)
class TrackPostViewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(BlogPost, id=post_id)
        
        # Check if user has already viewed this post
        view, created = BlogPostView.objects.get_or_create(user=request.user, post=post)
        
        if created:
            # User hasn't viewed this post before, increment view count
            post.views += 1
            post.save(update_fields=['views'])
            return Response({
                'viewed': True, 
                'views': post.views,
                'message': 'View count incremented'
            }, status=status.HTTP_201_CREATED)
        else:
            # User has already viewed this post
            return Response({
                'viewed': False, 
                'views': post.views,
                'message': 'Already viewed by this user'
            }, status=status.HTTP_200_OK)

# List/create categories with pagination & search
class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

# List/create tags with pagination & search
class TagListCreateView(generics.ListCreateAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

# List/create comments for a blog post with pagination & search
class CommentListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, post_id):
        post = get_object_or_404(BlogPost, id=post_id)
        comments = post.comments.filter(parent=None)
        # search by content, author
        search = request.query_params.get('search')
        if search:
            comments = comments.filter(content__icontains=search) | comments.filter(author__username__icontains=search)
        # Paginate
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(comments, request)
        serializer = CommentSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, post_id):
        post = get_object_or_404(BlogPost, id=post_id)
        data = request.data.copy()
        data['post'] = post.id
        serializer = CommentSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save(author=request.user, post=post)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Get trending tags ordered by usage count
class TrendingTagsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        
        # Get limit parameter, default to 10
        limit = int(request.query_params.get('limit', 10))
        
        # Get tags ordered by the number of blog posts using them
        trending_tags = Tag.objects.annotate(
            post_count=Count('blog_posts')
        ).filter(
            post_count__gt=0  # Only tags that are actually used
        ).order_by('-post_count')[:limit]
        
        # Serialize the tags
        serializer = TagSerializer(trending_tags, many=True)
        return Response(serializer.data)

# Get popular posts (most liked) - overall, not filtered
class PopularPostsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        
        # Get limit parameter, default to 5
        limit = int(request.query_params.get('limit', 5))
        
        # Get posts ordered by likes count
        popular_posts = BlogPost.objects.select_related('author', 'category').prefetch_related('tags').annotate(
            likes_count=Count('likes')
        ).order_by('-likes_count', '-published_at')[:limit]
        
        # Serialize the posts
        serializer = BlogPostSerializer(popular_posts, many=True, context={'request': request})
        return Response(serializer.data)

# Get categories with their post counts - overall, not filtered
class CategoriesWithCountsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        
        # Get categories with their post counts
        categories = Category.objects.annotate(
            post_count=Count('blog_posts')
        ).order_by('name')
        
        # Create a list of category data with post counts
        categories_data = []
        for category in categories:
            categories_data.append({
                'id': category.id,
                'name': category.name,
                'post_count': category.post_count
            })
        
        return Response(categories_data)

class CommentLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):
        comment = get_object_or_404(Comment, id=comment_id)
        like, created = CommentLike.objects.get_or_create(
            user=request.user,
            comment=comment
        )
        
        if not created:
            # If like already exists, remove it (unlike)
            like.delete()
            return Response({'liked': False}, status=status.HTTP_200_OK)
        
        return Response({'liked': True}, status=status.HTTP_201_CREATED)