from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from dotenv import load_dotenv
from .serializers import SignupSerializer, LoginSerializer, UserSerializer
import os


load_dotenv()


User = get_user_model()


class SignupView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(request, username=email, password=password)
        if user is not None:
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data
            })
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

class GoogleAuthCodeExchangeView(APIView):
    permission_classes = []

    def post(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"error": "Missing code"}, status=status.HTTP_400_BAD_REQUEST)

        CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
        CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
        REDIRECT_URI = "postmessage"

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
            flow.fetch_token(code=code)
            credentials = flow.credentials

            # Get user info from Google
            oauth2 = build("oauth2", "v2", credentials=credentials)
            user_info = oauth2.userinfo().get().execute()
            email = user_info.get("email")
            username = user_info.get("email").split("@")[0] if user_info.get("email") else None
            first_name = user_info.get("given_name", "")
            last_name = user_info.get("family_name", "")

            if not email:
                return Response({"error": "No email returned from Google"}, status=status.HTTP_400_BAD_REQUEST)

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                }
            )

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

            refresh = RefreshToken.for_user(user)
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
        try:
            if user_id is None or user_id == "me":
                user = request.user
            else:
                try:
                    user = User.objects.get(id=int(user_id))
                except (ValueError, TypeError, User.DoesNotExist):
                    return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            # Only allow users to update their own profile
            if user != request.user:
                return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
            
            print(f"Request data: {request.data}")
            print(f"Request files: {request.FILES}")
            
            serializer = UserSerializer(user, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                print(f"Serializer errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Unexpected error: {e}")
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
                    "message": f"Unfollowed {target_user.get_full_name()}"
                }, status=status.HTTP_200_OK)
            else:
                # Follow
                current_user.following.add(target_user)
                return Response({
                    "following": True,
                    "followers_count": target_user.followers.count(),
                    "message": f"Now following {target_user.get_full_name()}"
                }, status=status.HTTP_201_CREATED)
                
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)