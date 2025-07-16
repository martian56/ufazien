from django.urls import path

from .views import (
    BlogPostApiView,
    BlogPostDetailView,
    ToggleLikeView,
    ToggleBookmarkView,
    TrackPostViewView,
    CategoryListCreateView,
    TagListCreateView,
    TrendingTagsView,
    PopularPostsView,
    CategoriesWithCountsView,
    CommentListCreateView,
    CommentLikeView,
)
from .image_upload import upload_image

urlpatterns = [
    path("posts/", BlogPostApiView.as_view(), name="blogpost-list-create"),
    path("posts/<int:pk>/", BlogPostDetailView.as_view(), name="blogpost-detail"),
    path("posts/<int:post_id>/like/", ToggleLikeView.as_view(), name="blogpost-like"),
    path("posts/<int:post_id>/bookmark/", ToggleBookmarkView.as_view(), name="blogpost-bookmark"),
    path("posts/<int:post_id>/view/", TrackPostViewView.as_view(), name="blogpost-view"),
    path("bookmarks/<str:user_id>/", ToggleBookmarkView.as_view(), name="user-bookmarks"),
    path("categories/", CategoryListCreateView.as_view(), name="category-list-create"),
    path("categories/with-counts/", CategoriesWithCountsView.as_view(), name="categories-with-counts"),
    path("posts/popular/", PopularPostsView.as_view(), name="popular-posts"),
    path("tags/", TagListCreateView.as_view(), name="tag-list-create"),
    path("tags/trending/", TrendingTagsView.as_view(), name="trending-tags"),
    path("posts/<int:post_id>/comments/", CommentListCreateView.as_view(), name="comment-list-create"),
    path("comments/<int:comment_id>/like/", CommentLikeView.as_view(), name="comment-like"),
    path("upload/image/", upload_image, name="image-upload"),
]