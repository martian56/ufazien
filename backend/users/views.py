import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q
from dotenv import load_dotenv
from .serializers import (
    SignupSerializer,
    LoginSerializer,
    UserSerializer,
    UserSettingsSerializer,
)
from .models import User, UserSettings
from . import usernames
from api.services.notification_service import NotificationService
import os


load_dotenv()

logger = logging.getLogger(__name__)


User = get_user_model()


class SignupView(APIView):
    permission_classes = []
    # Rate limited by IP. Creating accounts had no ceiling either.
    throttle_scope = 'signup'

    def post(self, request):
        print(f"[SIGNUP] Request received - data keys: {list(request.data.keys())}")
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            print("[SIGNUP] Serializer valid, creating user")
            user = serializer.save()
            logger.info("Signup: created user id=%s", user.id)
            
            # Send welcome email
            try:
                NotificationService.send_welcome_email(user)
                print(f"[SIGNUP] Welcome email sent to user id={user.id}")
            except Exception as e:
                print(f"[SIGNUP] ERROR: Failed to send welcome email to user id={user.id}: {str(e)}")
            
            refresh = RefreshToken.for_user(user)
            print(f"[SIGNUP] Signup successful for user id={user.id}")
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={'request': request}).data
            })
        print(f"[SIGNUP] Validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = []
    # Signing in had no limit at all, so a password could be guessed as fast as
    # the network allowed. See `DEFAULT_THROTTLE_RATES` for the rate; it is
    # generous enough that mistyping yours a few times is unaffected.
    throttle_scope = 'login'

    def post(self, request):
        # No email in the log line. Every attempt used to print the address
        # somebody typed, which put user emails in the application logs — and
        # a failed sign-in is exactly where somebody else's address might be.
        logger.info("Login attempt received")
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            logger.info("Login rejected: the request was not valid")
            serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        # Try authenticating with email as username first (for regular signup users)
        user = authenticate(request, username=email, password=password)
        
        # If that fails, try to find user by email and authenticate with their actual username
        # This handles OAuth users who have username = email.split("@")[0]
        if user is None:
            candidates = list(User.objects.filter(email__iexact=email).order_by("id"))
            if not candidates:
                logger.info("Login attempted for an address with no account")
            for candidate in candidates:
                user = authenticate(request, username=candidate.username, password=password)
                logger.info("Login retry for user id=%s %s", candidate.id,
                            "succeeded" if user else "failed")
                if user is not None:
                    break
        
        if user is not None:
            logger.info("Login successful for user id=%s", user.id)
            # Send login alert email
            try:
                NotificationService.send_login_alert_email(user, request)
            except Exception as e:
                logger.warning("Login alert email failed for user id=%s: %s", user.id, e)
            
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={'request': request}).data
            })
        logger.info("Login failed: invalid credentials")
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

class GoogleAuthCodeExchangeView(APIView):
    permission_classes = []
    throttle_scope = 'login'

    def post(self, request):
        # Shapes, not contents.
        #
        # This block used to print every `HTTP_*` header — `Authorization` and
        # `Cookie` among them — forty characters of the authorization code
        # across two lines, and the whole request body whenever the code was
        # missing. An authorization code is a live credential: it is short and
        # single-use, but until it is redeemed it exchanges for somebody's
        # tokens, and logs outlive the exchange.
        logger.info("Google OAuth: request carried %s", ", ".join(sorted(request.data.keys())))

        code = request.data.get("code")
        code_verifier = request.data.get("code_verifier")  # Optional PKCE parameter
        if not code:
            logger.info("Google OAuth: rejected, no authorization code in the request")
            return Response({"error": "Missing code"}, status=status.HTTP_400_BAD_REQUEST)

        logger.info("Google OAuth: %s flow", "PKCE" if code_verifier else "standard")

        CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
        CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
        REDIRECT_URI = "postmessage"
        
        if not CLIENT_ID or not CLIENT_SECRET:
            logger.error("Google OAuth: CLIENT_ID or CLIENT_SECRET is not set")
            return Response({"error": "Server configuration error: Missing Google OAuth credentials"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": CLIENT_ID,
                        "client_secret": CLIENT_SECRET,
                        "redirect_uris": [REDIRECT_URI],
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=[
                    "openid",
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/userinfo.profile",
                ],
                redirect_uri=REDIRECT_URI,
            )
            # Token exchange with optional PKCE support
            if code_verifier:
                flow.fetch_token(code=code, code_verifier=code_verifier)
            else:
                flow.fetch_token(code=code)
            credentials = flow.credentials
            logger.info("Google OAuth: token exchange succeeded")

            oauth2 = build("oauth2", "v2", credentials=credentials)
            user_info = oauth2.userinfo().get().execute()
            
            email = user_info.get("email")
            first_name = user_info.get("given_name", "")
            last_name = user_info.get("family_name", "")
            
            # Names, not values. `username` here is the address's local part,
            # so printing it published most of the address; `user_info` is the
            # whole Google profile, address and picture included.
            logger.info("Google OAuth: profile carried %s", ", ".join(sorted(user_info.keys())))

            if not email:
                logger.warning(
                    "Google OAuth: no email in the profile; it carried %s",
                    ", ".join(sorted(user_info.keys())),
                )
                return Response({"error": "No email returned from Google"}, status=status.HTTP_400_BAD_REQUEST)

            logger.info("Google OAuth: resolving an account for the token address")
            existing = User.objects.filter(email__iexact=email).first()
            if existing is not None:
                user, created = existing, False
            else:
                user = User.objects.create(
                    email=email,
                    username=usernames.for_person(
                        first_name,
                        last_name,
                        lambda candidate: User.objects.filter(username__iexact=candidate).exists(),
                        email=email,
                    ),
                    first_name=first_name,
                    last_name=last_name,
                )
                created = True
            
            if created:
                logger.info("Google OAuth: created user id=%s", user.id)
            else:
                logger.info("Google OAuth: matched existing user id=%s", user.id)
            
            # For OAuth users, explicitly set unusable password if newly created
            if created:
                user.set_unusable_password()
                user.save()

            # Send welcome email for new Google OAuth users
            if created:
                try:
                    NotificationService.send_welcome_email(user)
                except Exception as e:
                    logger.warning("Google OAuth: welcome email failed for user id=%s: %s", user.id, type(e).__name__)
            else:
                # Send login alert for existing users
                try:
                    NotificationService.send_login_alert_email(user, request)
                except Exception as e:
                    logger.warning("Google OAuth: login alert failed for user id=%s: %s", user.id, type(e).__name__)

            # Optionally update names if user exists and info has changed
            updated = False
            if not created:
                if user.first_name != first_name:
                    user.first_name = first_name
                    updated = True
                if user.last_name != last_name:
                    user.last_name = last_name
                    updated = True
                if updated:
                    user.save()
                    logger.info("Google OAuth: refreshed the name on user id=%s", user.id)

            refresh = RefreshToken.for_user(user)
            logger.info("Google OAuth: login successful for user id=%s", user.id)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                }
            })
        except Exception as e:
            error_message = str(e)

            # The traceback goes to the log, where the operator can read it.
            # It used to go to stdout *and* the message went back to the
            # browser, and a failure from Google quotes what was sent — which
            # on an `invalid_client` is the client secret.
            logger.exception("Google OAuth: exchange failed")

            if "invalid_grant" in error_message.lower():
                logger.info("Google OAuth: the code was expired, already used, "
                            "or the redirect_uri did not match")
            elif "invalid_client" in error_message.lower():
                logger.info("Google OAuth: CLIENT_ID or CLIENT_SECRET is wrong")
            elif "redirect" in error_message.lower():
                logger.info("Google OAuth: redirect_uri mismatch; this end expects %r",
                            REDIRECT_URI)

            return Response(
                {"error": "Could not complete the Google sign-in. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
def can_view_profile(viewer, target):
    """Whether `viewer` may see `target`'s full profile.

    The Privacy tab has offered this setting for as long as it has existed and
    nothing ever read it, so every profile was public regardless. Your own
    profile is always visible to you.
    """
    if viewer == target:
        return True

    settings_row = getattr(target, "settings", None)
    if settings_row is None:
        return True

    if settings_row.profile_visibility == UserSettings.ProfileVisibility.NOBODY:
        return False
    if settings_row.profile_visibility == UserSettings.ProfileVisibility.FOLLOWERS:
        return target.followers.filter(id=viewer.id).exists()
    return True


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id=None):
        try:
            if user_id is None or user_id == "me":
                user = request.user
            else:
                try:
                    user = User.objects.get(id=int(user_id))
                except (ValueError, TypeError, User.DoesNotExist):
                    return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            if not can_view_profile(request.user, user):
                # A restricted profile is not a missing one: you can still see
                # who it is well enough to ask to follow them. Everything else,
                # including the counts and the bio, is withheld.
                return Response(
                    {
                        "id": user.id,
                        "username": user.username,
                        "avatar_url": (
                            request.build_absolute_uri(user.avatar.url) if user.avatar else None
                        ),
                        "profile_restricted": True,
                        "is_following": request.user.following.filter(id=user.id).exists(),
                    },
                    status=status.HTTP_200_OK,
                )

            serializer = UserSerializer(user, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, user_id=None):
        print(f"[USER PROFILE PATCH] Request - user_id={user_id}, requesting_user_id={request.user.id if request.user.is_authenticated else 'anonymous'}")
        try:
            if user_id is None or user_id == "me":
                user = request.user
                print(f"[USER PROFILE PATCH] Using requesting user as target: id={user.id}")
            else:
                try:
                    user = User.objects.get(id=int(user_id))
                    print(f"[USER PROFILE PATCH] Found target user: id={user.id}")
                except (ValueError, TypeError, User.DoesNotExist):
                    print(f"[USER PROFILE PATCH] ERROR: User not found - user_id={user_id}")
                    return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            # Only allow users to update their own profile
            if user != request.user:
                print(f"[USER PROFILE PATCH] ERROR: Permission denied - user_id={user.id} tried to update user_id={request.user.id}")
                return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
            
            print(f"[USER PROFILE PATCH] Request data keys: {list(request.data.keys())}")
            print(f"[USER PROFILE PATCH] Request files: {list(request.FILES.keys()) if request.FILES else 'None'}")
            
            serializer = UserSerializer(user, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                print(f"[USER PROFILE PATCH] Profile updated successfully for user_id={user.id}")
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                print(f"[USER PROFILE PATCH] Validation failed for user_id={user.id}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            print(f"[USER PROFILE PATCH] ERROR: User.DoesNotExist - user_id={user_id}")
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            print(f"[USER PROFILE PATCH] ERROR: Unexpected error - {str(e)}")
            print(f"[USER PROFILE PATCH] Traceback: {traceback.format_exc()}")
            return Response({"detail": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Follow/Unfollow a user
class FollowUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
            current_user = request.user
            
            # Don't allow users to follow themselves
            if target_user == current_user:
                return Response({"detail": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already following
            if current_user.following.filter(id=target_user.id).exists():
                # Unfollow
                current_user.following.remove(target_user)
                return Response({
                    "following": False,
                    "followers_count": target_user.followers.count(),
                    "following_count": current_user.following.count(),
                    "message": f"Unfollowed {target_user.get_full_name()}"
                }, status=status.HTTP_200_OK)
            else:
                # Follow
                current_user.following.add(target_user)
                return Response({
                    "following": True,
                    "followers_count": target_user.followers.count(),
                    "following_count": current_user.following.count(),
                    "message": f"Now following {target_user.get_full_name()}"
                }, status=status.HTTP_201_CREATED)
                
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Search users by name (first_name + last_name), excluding the current user"""
        query = request.query_params.get('q', '').strip()
        
        if not query or len(query) < 2:
            return Response({
                "results": [],
                "message": "Please provide at least 2 characters to search"
            })
        
        # Search by first name or last name, exclude current user and username/email
        users = User.objects.filter(
            Q(first_name__icontains=query) | Q(last_name__icontains=query)
        ).exclude(
            id=request.user.id
        ).only(
            'id', 'first_name', 'last_name', 'avatar', 'year', 'major'
        )[:20]  # Limit to 20 results
        
        # Create privacy-safe user data
        results = []
        for user in users:
            results.append({
                'id': user.id,
                'name': user.get_full_name(),
                'avatar': request.build_absolute_uri(user.avatar.url) if user.avatar else None,
                'year': user.year,
                'major': user.get_major_display(),
            })
        
        return Response({
            "results": results,
            "count": len(results)
        })


class SetPasswordView(APIView):
    """
    Allow users who signed up via Google OAuth (and don't have a password) 
    to set a password for CLI tool authentication.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        password = request.data.get('password')
        password_confirm = request.data.get('password_confirm')
        
        if not password:
            return Response(
                {"detail": "Password is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if password != password_confirm:
            return Response(
                {"detail": "Passwords do not match."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate password strength
        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters long."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        
        # Check if user already has a usable password by examining password field directly
        from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
        has_password = False
        if user.password:
            # Password exists and is not marked as unusable
            if not user.password.startswith(UNUSABLE_PASSWORD_PREFIX):
                has_password = True
        
        if has_password:
            return Response(
                {"detail": "You already have a password set. Use change password instead."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set the password
        user.set_password(password)
        user.save()
        
        return Response({
            "message": "Password set successfully. You can now use email and password to authenticate.",
            "has_password": True
        }, status=status.HTTP_200_OK)

class UserSettingsView(APIView):
    """Read and update the requesting user's own preferences.

    Always scoped to request.user: there is no path here that reads or writes
    anyone else's settings. Some of these describe who may see what about a
    user, so serving them to another account would defeat their purpose.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _settings_for(self, user):
        settings_row, _ = UserSettings.objects.get_or_create(user=user)
        return settings_row

    def get(self, request):
        return Response(UserSettingsSerializer(self._settings_for(request.user)).data)

    def patch(self, request):
        serializer = UserSettingsSerializer(
            self._settings_for(request.user), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
