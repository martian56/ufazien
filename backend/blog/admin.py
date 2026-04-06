from django.contrib import admin
from .models import (
    BlogPost, Category, Tag, Comment,
    BlogPostLike, BlogPostBookmark, CommentLike
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