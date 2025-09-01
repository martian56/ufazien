"""
ASGI config for ufazien project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator
from django.conf import settings
import logging
from urllib.parse import parse_qs

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ufazien.settings')

django_asgi_app = get_asgi_application()

# Import WebSocket URL routing and JWT middleware
from game.routing import websocket_urlpatterns
from game.middleware import JWTAuthMiddlewareStack

def LoggingMiddleware(inner):
    """Simple ASGI wrapper to log WS handshake headers before validators run."""
    logger = logging.getLogger('ufazien.asgi')

    async def app(scope, receive, send):
        if scope.get('type') == 'websocket':
            # Safe logging: do not print token values. Show presence/length only.
            headers = {k.decode(): v.decode() for k, v in scope.get('headers', [])}
            origin = headers.get('origin', '')
            host = headers.get('host', '')
            has_auth = 'yes' if headers.get('authorization') else 'no'
            qs = scope.get('query_string', b'').decode()
            qs_map = parse_qs(qs)
            token_present = 'yes' if 'token' in qs_map else 'no'
            line = f"WS handshake attempt path={scope.get('path')} origin={origin} host={host} auth_header={has_auth} query_token={token_present}"
            # Print to stdout so container logs capture it even if logger level is higher
            print(line)
            logger.info(line)
        return await inner(scope, receive, send)

    return app


# Build two websocket application variants: origin-validated and host-validated.
# Then choose per-connection which one to call based on presence of Origin header.
inner_app = JWTAuthMiddlewareStack(
    URLRouter(websocket_urlpatterns)
)

# origin-validated app (only if CORS origins configured)
origin_validated_app = None
if getattr(settings, 'CORS_ALLOWED_ORIGINS', None):
    origin_validated_app = OriginValidator(inner_app, settings.CORS_ALLOWED_ORIGINS)

# host-validated fallback app
host_validated_app = AllowedHostsOriginValidator(inner_app)

async def websocket_chooser(scope, receive, send):
    # Decide which validator to use: prefer OriginValidator when an Origin header is present
    headers = {k.decode(): v.decode() for k, v in scope.get('headers', [])}
    origin = headers.get('origin', '')
    # If there is an origin and we have an origin validator configured, use it.
    if origin and origin_validated_app is not None:
        return await origin_validated_app(scope, receive, send)
    # Otherwise fall back to host-based validation to support non-browser clients
    return await host_validated_app(scope, receive, send)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Wrap websocket chooser with logging middleware so we always see the handshake details
    "websocket": LoggingMiddleware(websocket_chooser),
})
