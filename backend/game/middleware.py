"""
Custom authentication middleware for WebSocket connections.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings

User = get_user_model()


@database_sync_to_async
def get_user_by_token(token):
    """
    Get user from JWT token using Django Simple JWT.
    """
    try:
        # Validate the token
        UntypedToken(token)
        
        # Decode the token to get user info
        decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = decoded_data.get('user_id')
        
        if user_id:
            user = User.objects.get(id=user_id)
            return user
    except (InvalidToken, TokenError, User.DoesNotExist) as e:
        print(f"JWT Auth error: {e}")
        pass
    return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    Token can be passed as:
    1. Query parameter: ?token=<jwt_token>
    2. Authorization header: Bearer <jwt_token>
    """

    async def __call__(self, scope, receive, send):
        # Try to get token from query parameters first
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = None
        
        # Check query parameters
        if 'token' in query_params:
            token = query_params['token'][0]
        
        # Check headers for Authorization
        if not token:
            headers = dict(scope.get('headers', []))
            auth_header = headers.get(b'authorization', b'').decode()
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        # Authenticate user with token
        if token:
            scope['user'] = await get_user_by_token(token)
        else:
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """
    Convenience function to wrap the given application with JWT authentication middleware.
    """
    return JWTAuthMiddleware(inner)
