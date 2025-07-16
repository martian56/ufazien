from django.urls import path
from . import views

urlpatterns = [
    path('', views.ApiStatus.as_view(), name='api_status')
]