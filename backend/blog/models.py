from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class BlogPost(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        UNLISTED = "unlisted", "Unlisted"
        FOLLOWERS = "followers", "Followers only"
        PRIVATE = "private", "Private"

    title = models.CharField(max_length=255)
    content = models.TextField()  # Now stores HTML content
    excerpt = models.CharField(max_length=300, blank=True)
    featured_image = models.ImageField(upload_to='blog/featured/', null=True, blank=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='blog_posts')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='blog_posts')
    tags = models.ManyToManyField(Tag, related_name='blog_posts')
    created_at = models.DateTimeField(auto_now_add=True)
    # Was auto_now_add, which made it the creation time. A draft written on
    # Monday and published on Friday claimed Monday, and ordering by it put a
    # freshly published post wherever it happened to be started.
    published_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    read_time = models.CharField(max_length=20)
    views = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    # The editor has offered this choice since it was written, but never sent
    # it: picking "Private" published the post to everyone. Enforced in
    # BlogPost.visible_to now, not in the browser.
    visibility = models.CharField(
        max_length=20, choices=Visibility.choices, default=Visibility.PUBLIC
    )

    class Meta:
        # Drafts have no published_at, so fall back to when they were created.
        ordering = ['-published_at', '-created_at']

    @property
    def is_scheduled(self):
        """Published, but dated forward, so not live yet."""
        return bool(self.is_published and self.published_at and self.published_at > timezone.now())

    def save(self, *args, **kwargs):
        # Stamp the moment it actually goes live, and clear it if unpublished
        # so a repost is dated correctly rather than keeping the old date.
        # A date the author picked is kept as-is, including a future one: that
        # is how scheduling works here, with visible_to filtering on the clock
        # rather than a worker flipping a flag.
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        elif not self.is_published:
            self.published_at = None
        super().save(*args, **kwargs)

    @classmethod
    def visible_to(cls, user):
        """Posts `user` is allowed to see, by visibility and publish time.

        Authors always see their own, whatever the setting and whenever it is
        scheduled for. Everyone else sees public posts that are live, plus
        followers-only posts by authors they follow. Unlisted posts stay out of
        listings but remain reachable by direct link, so the detail view widens
        this rather than reusing it unchanged.
        """
        own = models.Q(author=user)
        live = models.Q(is_published=True) & (
            models.Q(published_at__isnull=True) | models.Q(published_at__lte=timezone.now())
        )
        allowed = models.Q(visibility=cls.Visibility.PUBLIC) | models.Q(
            visibility=cls.Visibility.FOLLOWERS, author__followers=user
        )
        return cls.objects.filter(own | (live & allowed))

    def __str__(self):
        return self.title

class Comment(models.Model):
    post = models.ForeignKey('BlogPost', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='comments')
    content = models.TextField()
    published_at = models.DateTimeField(auto_now_add=True)
    parent = models.ForeignKey('self', null=True, blank=True, related_name='replies', on_delete=models.CASCADE)

    def __str__(self):
        return f'Comment by {self.author} on {self.post}'

class BlogPostBookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'post')

class BlogPostLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name='likes')

    class Meta:
        unique_together = ('user', 'post')

class BlogPostView(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')

class CommentLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'comment')