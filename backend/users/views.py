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
from .serializers import SignupSerializer, LoginSerializer, UserSerializer
from api.services.notification_service import NotificationService
import os


load_dotenv()


User = get_user_model()


class SignupView(APIView):
    permission_classes = []

    def post(self, request):
        print(f"[SIGNUP] Request received - data keys: {list(request.data.keys())}")
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            print("[SIGNUP] Serializer valid, creating user")
            user = serializer.save()
            print(f"[SIGNUP] User created - id={user.id}, email={user.email}, username={user.username}")
            
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

    def post(self, request):
        print(f"[LOGIN] Request received - data keys: {list(request.data.keys())}")
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            print(f"[LOGIN] Validation failed: {serializer.errors}")
            serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        print(f"[LOGIN] Login attempt for email: {email}")
        
        # Try authenticating with email as username first (for regular signup users)
        user = authenticate(request, username=email, password=password)
        print(f"[LOGIN] First auth attempt result: {'SUCCESS' if user else 'FAILED'}")
        
        # If that fails, try to find user by email and authenticate with their actual username
        # This handles OAuth users who have username = email.split("@")[0]
        if user is None:
            try:
                user_obj = User.objects.get(email=email)
                print(f"[LOGIN] User found by email, attempting auth with username: {user_obj.username}")
                # Try authenticating with the user's actual username
                user = authenticate(request, username=user_obj.username, password=password)
                print(f"[LOGIN] Second auth attempt result: {'SUCCESS' if user else 'FAILED'}")
            except User.DoesNotExist:
                print(f"[LOGIN] No user found with email: {email}")
                user = None
        
        if user is not None:
            print(f"[LOGIN] Login successful for user id={user.id}, email={user.email}")
            # Send login alert email
            try:
                NotificationService.send_login_alert_email(user, request)
            except Exception as e:
                print(f"[LOGIN] WARNING: Failed to send login alert email to user id={user.id}: {str(e)}")
            
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={'request': request}).data
            })
        print(f"[LOGIN] Login failed: Invalid credentials for email {email}")
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

class GoogleAuthCodeExchangeView(APIView):
    permission_classes = []

    def post(self, request):
        print("=" * 80)
        print("[GOOGLE OAUTH] Request received")
        print(f"[GOOGLE OAUTH] Request method: {request.method}")
        print(f"[GOOGLE OAUTH] Request path: {request.path}")
        print(f"[GOOGLE OAUTH] Request data keys: {list(request.data.keys())}")
        print(f"[GOOGLE OAUTH] Request META (relevant): {[(k, request.META.get(k)) for k in request.META.keys() if 'HTTP_' in k or 'CONTENT_TYPE' in k]}")
        
        code = request.data.get("code")
        code_verifier = request.data.get("code_verifier")  # Optional PKCE parameter
        print(f"[GOOGLE OAUTH] Code extracted: {code is not None}")
        print(f"[GOOGLE OAUTH] Code verifier present: {code_verifier is not None}")
        if code:
            print(f"[GOOGLE OAUTH] Code length: {len(code)}")
            print(f"[GOOGLE OAUTH] Code first 30 chars: {code[:30]}...")
            print(f"[GOOGLE OAUTH] Code last 10 chars: ...{code[-10:]}")
            if code_verifier:
                print(f"[GOOGLE OAUTH] Code verifier length: {len(code_verifier)}")
                print(f"[GOOGLE OAUTH] Using PKCE flow (mobile app)")
            else:
                print(f"[GOOGLE OAUTH] Using standard flow (web app)")
        else:
            print("[GOOGLE OAUTH] ERROR: Code is None or missing")
            print(f"[GOOGLE OAUTH] Full request.data: {request.data}")
            return Response({"error": "Missing code"}, status=status.HTTP_400_BAD_REQUEST)

        CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
        CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
        REDIRECT_URI = "postmessage"
        
        print(f"[GOOGLE OAUTH] Environment check:")
        print(f"[GOOGLE OAUTH]   CLIENT_ID present: {bool(CLIENT_ID)}")
        print(f"[GOOGLE OAUTH]   CLIENT_SECRET present: {bool(CLIENT_SECRET)}")
        print(f"[GOOGLE OAUTH]   CLIENT_ID length: {len(CLIENT_ID) if CLIENT_ID else 0}")
        print(f"[GOOGLE OAUTH]   CLIENT_SECRET length: {len(CLIENT_SECRET) if CLIENT_SECRET else 0}")
        print(f"[GOOGLE OAUTH]   REDIRECT_URI: {REDIRECT_URI}")
        
        if not CLIENT_ID or not CLIENT_SECRET:
            print("[GOOGLE OAUTH] ERROR: Missing Google OAuth credentials in environment")
            return Response({"error": "Server configuration error: Missing Google OAuth credentials"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            print("[GOOGLE OAUTH] Initializing Flow...")
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
            print("[GOOGLE OAUTH] Flow initialized successfully")
            
            # Token exchange with optional PKCE support
            if code_verifier:
                print(f"[GOOGLE OAUTH] Attempting PKCE token exchange with code (length={len(code)}) and code_verifier (length={len(code_verifier)})...")
                flow.fetch_token(code=code, code_verifier=code_verifier)
            else:
                print(f"[GOOGLE OAUTH] Attempting standard token exchange with code (length={len(code)})...")
                flow.fetch_token(code=code)
            credentials = flow.credentials
            print("[GOOGLE OAUTH] Token exchange successful!")
            print(f"[GOOGLE OAUTH] Token type: {type(credentials)}")
            print(f"[GOOGLE OAUTH] Has access token: {hasattr(credentials, 'token')}")

            # Get user info from Google
            print("[GOOGLE OAUTH] Fetching user info from Google API...")
            oauth2 = build("oauth2", "v2", credentials=credentials)
            user_info = oauth2.userinfo().get().execute()
            print(f"[GOOGLE OAUTH] User info retrieved. Keys: {list(user_info.keys())}")
            
            email = user_info.get("email")
            username = user_info.get("email").split("@")[0] if user_info.get("email") else None
            first_name = user_info.get("given_name", "")
            last_name = user_info.get("family_name", "")
            
            print(f"[GOOGLE OAUTH] Extracted user data:")
            print(f"[GOOGLE OAUTH]   Email: {email}")
            print(f"[GOOGLE OAUTH]   Username: {username}")
            print(f"[GOOGLE OAUTH]   First name: {first_name}")
            print(f"[GOOGLE OAUTH]   Last name: {last_name}")

            if not email:
                print("[GOOGLE OAUTH] ERROR: No email returned from Google")
                print(f"[GOOGLE OAUTH] Full user_info response: {user_info}")
                return Response({"error": "No email returned from Google"}, status=status.HTTP_400_BAD_REQUEST)

            print(f"[GOOGLE OAUTH] Creating/retrieving user with email: {email}")
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                }
            )
            
            if created:
                print(f"[GOOGLE OAUTH] New user created - id={user.id}, email={user.email}, username={user.username}")
            else:
                print(f"[GOOGLE OAUTH] Existing user found - id={user.id}, email={user.email}, username={user.username}")
            
            # For OAuth users, explicitly set unusable password if newly created
            if created:
                user.set_unusable_password()
                user.save()
                print(f"[GOOGLE OAUTH] Set unusable password for new user id={user.id}")

            # Send welcome email for new Google OAuth users
            if created:
                try:
                    NotificationService.send_welcome_email(user)
                    print(f"[GOOGLE OAUTH] Welcome email sent to new user id={user.id}")
                except Exception as e:
                    print(f"[GOOGLE OAUTH] WARNING: Failed to send welcome email to user id={user.id}: {str(e)}")
            else:
                # Send login alert for existing users
                try:
                    NotificationService.send_login_alert_email(user, request)
                    print(f"[GOOGLE OAUTH] Login alert email sent to existing user id={user.id}")
                except Exception as e:
                    print(f"[GOOGLE OAUTH] WARNING: Failed to send login alert email to user id={user.id}: {str(e)}")

            # Optionally update names if user exists and info has changed
            updated = False
            if not created:
                if user.first_name != first_name:
                    print(f"[GOOGLE OAUTH] Updating first_name for user id={user.id} from '{user.first_name}' to '{first_name}'")
                    user.first_name = first_name
                    updated = True
                if user.last_name != last_name:
                    print(f"[GOOGLE OAUTH] Updating last_name for user id={user.id} from '{user.last_name}' to '{last_name}'")
                    user.last_name = last_name
                    updated = True
                if updated:
                    user.save()
                    print(f"[GOOGLE OAUTH] Updated user profile for id={user.id}")

            refresh = RefreshToken.for_user(user)
            print(f"[GOOGLE OAUTH] Login successful for user id={user.id}, email={user.email}")
            print("=" * 80)
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
            import traceback
            error_type = type(e).__name__
            error_message = str(e)
            error_traceback = traceback.format_exc()
            
            print("=" * 80)
            print("[GOOGLE OAUTH] ERROR: Exception occurred")
            print(f"[GOOGLE OAUTH] Error type: {error_type}")
            print(f"[GOOGLE OAUTH] Error message: {error_message}")
            print(f"[GOOGLE OAUTH] Full traceback:")
            print(error_traceback)
            print("=" * 80)
            
            # Log specific error types for better debugging
            if "invalid_grant" in error_message.lower():
                print("[GOOGLE OAUTH] DIAGNOSIS: Invalid grant error - Code may be expired, already used, or redirect_uri mismatch")
            elif "invalid_client" in error_message.lower():
                print("[GOOGLE OAUTH] DIAGNOSIS: Invalid client error - CLIENT_ID or CLIENT_SECRET may be incorrect")
            elif "redirect_uri_mismatch" in error_message.lower() or "redirect" in error_message.lower():
                print("[GOOGLE OAUTH] DIAGNOSIS: Redirect URI mismatch - The redirect_uri used in OAuth flow doesn't match backend expectation")
                print(f"[GOOGLE OAUTH] DIAGNOSIS: Backend expects redirect_uri: '{REDIRECT_URI}'")
            
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
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