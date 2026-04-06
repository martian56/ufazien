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
from game.routing import websocket_urlpatterns as game_websocket_urlpatterns
from community.routing import websocket_urlpatterns as community_websocket_urlpatterns
from game.middleware import JWTAuthMiddlewareStack

# Combine all WebSocket URL patterns
all_websocket_urlpatterns = game_websocket_urlpatterns + community_websocket_urlpatterns

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
            
            # Wrap send to log rejections
            original_send = send
            async def wrapped_send(message):
                if message.get('type') == 'websocket.close':
                    print(f"WS REJECTION: path={scope.get('path')} origin={origin} code={message.get('code', 'N/A')} reason={message.get('reason', 'N/A')}")
                    logger.warning(f"WS REJECTION: path={scope.get('path')} origin={origin} code={message.get('code', 'N/A')} reason={message.get('reason', 'N/A')}")
                return await original_send(message)
            
            return await inner(scope, receive, wrapped_send)
        return await inner(scope, receive, send)

    return app


# Build two websocket application variants: origin-validated and host-validated.
# Then choose per-connection which one to call based on presence of Origin header.
inner_app = JWTAuthMiddlewareStack(
    URLRouter(all_websocket_urlpatterns)
)

# Use AllowedHostsOriginValidator which validates based on ALLOWED_HOSTS
# This is more lenient and allows any origin from ALLOWED_HOSTS domains
allowed_hosts_validated_app = AllowedHostsOriginValidator(inner_app)

# Build comprehensive allowed origins list for strict OriginValidator (optional fallback)
allowed_hosts = getattr(settings, 'ALLOWED_HOSTS', ['localhost', '127.0.0.1'])
# Convert to origins for WebSocket validation - include both http and https
allowed_origins = []
for host in allowed_hosts:
    allowed_origins.extend([
        f"http://{host}",
        f"https://{host}",
        f"http://{host}:8000",
        f"https://{host}:8000",
        f"http://{host}:3000",  # Frontend dev server
        f"https://{host}:3000",
    ])
# Add common production domains
allowed_origins.extend([
    "http://ufazien.com",
    "https://ufazien.com", 
    "http://www.ufazien.com",
    "https://www.ufazien.com",
    "http://api.ufazien.com",
    "https://api.ufazien.com",
])

# Also include CORS_ALLOWED_ORIGINS if configured
cors_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
if cors_origins:
    allowed_origins.extend(cors_origins)

# Remove duplicates while preserving order
seen = set()
unique_allowed_origins = []
for origin in allowed_origins:
    if origin not in seen:
        seen.add(origin)
        unique_allowed_origins.append(origin)

# Create strict origin-validated app as fallback (optional)
origin_validated_app = OriginValidator(inner_app, unique_allowed_origins)

async def websocket_chooser(scope, receive, send):
    """
    Choose appropriate WebSocket validator based on request characteristics.
    Uses AllowedHostsOriginValidator by default for better compatibility.
    """
    headers = {k.decode(): v.decode() for k, v in scope.get('headers', [])}
    origin = headers.get('origin', '')
    
    # If there is no origin header (common with Python websockets library or Postman), 
    # use the inner app directly without origin validation
    if not origin:
        print(f"WS: No origin header, bypassing origin validation")
        return await inner_app(scope, receive, send)
    
    # Use AllowedHostsOriginValidator which is more lenient
    # It validates based on ALLOWED_HOSTS, allowing any origin from allowed hosts
    print(f"WS: Origin header present: {origin}, using AllowedHostsOriginValidator")
    try:
        return await allowed_hosts_validated_app(scope, receive, send)
    except Exception as e:
        print(f"WS: AllowedHostsOriginValidator failed: {e}, trying strict OriginValidator")
        # Fallback to strict OriginValidator if AllowedHostsOriginValidator fails
        return await origin_validated_app(scope, receive, send)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Wrap websocket chooser with logging middleware so we always see the handshake details
    "websocket": LoggingMiddleware(websocket_chooser),
})
