from django.urls import path
from .views import MeView, UserListCreateView, UserDetailView

urlpatterns = [
    path("me/", MeView.as_view(), name="user-me"),
    path("", UserListCreateView.as_view(), name="user-list"),
    path("<uuid:pk>/", UserDetailView.as_view(), name="user-detail"),
]
