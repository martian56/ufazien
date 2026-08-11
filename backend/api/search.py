from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from average.models import AverageSchema
from blog.models import BlogPost
from community.models import Forum, ForumPost, Group
from hosting.models import Website
from schedule.models import CalendarEvent

User = get_user_model()

MIN_QUERY = 2
PER_GROUP = 5


def _blog_posts(user, q):
    posts = (
        BlogPost.visible_to(user)
        .filter(Q(title__icontains=q) | Q(excerpt__icontains=q) | Q(content__icontains=q))
        .select_related("author")
        .distinct()[:PER_GROUP]
    )
    return [
        {
            "type": "blog",
            "label": "Blog",
            "title": p.title,
            "subtitle": p.excerpt[:120] or p.author.username,
            "url": f"/blog/{p.id}",
        }
        for p in posts
    ]


def _groups(user, q):
    visible = Group.objects.filter(is_active=True).filter(
        Q(type="public") | Q(members=user)
    )
    groups = visible.filter(
        Q(name__icontains=q) | Q(description__icontains=q) | Q(course_code__icontains=q)
    ).distinct()[:PER_GROUP]
    return [
        {
            "type": "group",
            "label": "Study group",
            "title": g.name,
            "subtitle": g.description[:120],
            "url": "/community",
        }
        for g in groups
    ]


def _forums(q):
    forums = Forum.objects.filter(is_active=True).filter(
        Q(title__icontains=q) | Q(description__icontains=q)
    )[:PER_GROUP]
    return [
        {
            "type": "forum",
            "label": "Forum",
            "title": f.title,
            "subtitle": f.description[:120],
            "url": "/community",
        }
        for f in forums
    ]


def _forum_posts(q):
    posts = (
        ForumPost.objects.filter(Q(title__icontains=q) | Q(content__icontains=q))
        .select_related("author")
        .distinct()[:PER_GROUP]
    )
    return [
        {
            "type": "post",
            "label": "Community post",
            "title": p.title,
            "subtitle": p.content[:120],
            "url": f"/community/posts/{p.id}",
        }
        for p in posts
    ]


def _schemas(user, q):
    schemas = (
        AverageSchema.objects.filter(Q(is_public=True) | Q(creator=user))
        .filter(Q(name__icontains=q) | Q(description__icontains=q))
        .distinct()[:PER_GROUP]
    )
    return [
        {
            "type": "schema",
            "label": "Average schema",
            "title": s.name,
            "subtitle": s.description[:120],
            "url": "/average-calculator",
        }
        for s in schemas
    ]


def _events(user, q):
    events = CalendarEvent.objects.filter(user=user).filter(
        Q(title__icontains=q) | Q(description__icontains=q) | Q(location__icontains=q)
    )[:PER_GROUP]
    return [
        {
            "type": "event",
            "label": "Calendar",
            "title": e.title,
            "subtitle": e.date.isoformat(),
            "url": "/calendar",
        }
        for e in events
    ]


def _websites(user, q):
    sites = Website.objects.filter(user=user).filter(
        Q(name__icontains=q) | Q(description__icontains=q)
    )[:PER_GROUP]
    return [
        {
            "type": "website",
            "label": "Your site",
            "title": w.name,
            "subtitle": w.description[:120],
            "url": f"/hosting/website/{w.id}",
        }
        for w in sites
    ]


def _people(q):
    people = User.objects.filter(
        Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q)
    )[:PER_GROUP]
    out = []
    for u in people:
        full = f"{u.first_name} {u.last_name}".strip()
        out.append(
            {
                "type": "person",
                "label": "Student",
                "title": full or u.username,
                "subtitle": f"@{u.username}",
                "url": f"/profile/{u.id}",
            }
        )
    return out


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search(request):
    q = (request.query_params.get("q") or "").strip()
    if len(q) < MIN_QUERY:
        return Response({"query": q, "results": []})

    user = request.user
    results = (
        _blog_posts(user, q)
        + _forum_posts(q)
        + _groups(user, q)
        + _forums(q)
        + _schemas(user, q)
        + _events(user, q)
        + _websites(user, q)
        + _people(q)
    )
    return Response({"query": q, "results": results})
