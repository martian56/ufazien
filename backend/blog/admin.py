from django.contrib import admin
from .models import (
    BlogPost, Category, Tag, Comment,
    BlogPostLike, BlogPostBookmark, CommentLike, BlogPostView
)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'category', 'published_at')
    search_fields = ('title', 'content')
    list_filter = ('category', 'tags')
    raw_id_fields = ('author',)

class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'id')
    search_fields = ('name',) 
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'id')
    search_fields = ('name',)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('post', 'author', 'published_at', 'parent')
    search_fields = ('content',)
    raw_id_fields = ('author', 'post')
    list_filter = ('post', 'author')
class BlogPostLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'post')
    search_fields = ('user__username', 'post__title')
    raw_id_fields = ('user', 'post')
class BlogPostBookmarkAdmin(admin.ModelAdmin):
    list_display = ('user', 'post')
    search_fields = ('user__username', 'post__title')
    raw_id_fields = ('user', 'post')
class CommentLikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'comment')
    search_fields = ('user__username', 'comment__content')
    raw_id_fields = ('user', 'comment')


admin.site.register(BlogPost, BlogPostAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Tag, TagAdmin)
admin.site.register(Comment, CommentAdmin)
admin.site.register(BlogPostLike, BlogPostLikeAdmin)
admin.site.register(BlogPostBookmark, BlogPostBookmarkAdmin)
admin.site.register(CommentLike, CommentLikeAdmin)


@admin.register(BlogPostView)
class BlogPostViewAdmin(admin.ModelAdmin):
    """One row per read. This is what the view counts on posts are built from."""

    list_display = ['post', 'user', 'viewed_at']
    list_filter = ['viewed_at']
    search_fields = ['post__title', 'user__username', 'user__first_name', 'user__last_name']
    readonly_fields = ['viewed_at']
    list_select_related = ['post', 'user']
    date_hierarchy = 'viewed_at'
