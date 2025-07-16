from django.urls import path

from .views import( 
    SignupView, 
    LoginView, 
    GoogleAuthCodeExchangeView,
    UserProfileView,
    FollowUserView
)
from rest_framework_simplejwt.views import TokenRefreshView


urlpatterns = [
    path("google/login/", GoogleAuthCodeExchangeView.as_view(), name="google_login"),
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("user/", UserProfileView.as_view(), name="my_profile"),          # /user/ for current user
    path("user/<user_id>/", UserProfileView.as_view(), name="user_profile"),  # /user/me/ or /user/123/
    path("user/<user_id>/follow/", FollowUserView.as_view(), name="follow_user"),  # /user/123/follow/
]