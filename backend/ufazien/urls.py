from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

# Main URL configuration for the ufazien project.
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/blog/', include('blog.urls')),
    path('api/auth/', include('users.urls')),
    path('api/average/', include('average.urls')),
    path('api/gpa/', include('gpa.urls')),
    path('api/game/', include('game.urls')),
    path('api/ai-tools/', include('ai_tools.urls')),
    path('api/hosting/', include('hosting.urls')),
    path('api/community/', include('community.urls')),
    path('api/calendar/', include('schedule.urls')),
]


# Api schema generation and documentation
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
urlpatterns += [
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
] 


# Serve user-uploaded media.
#
# static() is a no-op unless DEBUG is True, so it silently stopped serving
# /media/ the moment DEBUG was turned off in production. WhiteNoise does not
# cover this either: it serves STATIC_ROOT, and its file list is built once at
# start-up, so it would never see anything uploaded after boot.
#
# django.views.static.serve reads from disk per request, so uploads are visible
# immediately. It is not a high-throughput file server; if media traffic ever
# becomes significant, move this to a web server sitting in front of the app.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]