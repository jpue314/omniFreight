from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)
from apps.inventory.views import ReorderQueueView

v1 = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("users/", include("apps.users.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("vendors/", include("apps.vendors.urls")),
    path("machines/", include("apps.machines.urls")),
    path("health/", include("apps.users.health_urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("reorder/", ReorderQueueView.as_view(), name="reorder-queue"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(v1)),
]
