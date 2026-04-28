from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import ListModelMixin

from apps.core.pagination import StandardPagination
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(ListModelMixin, GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(read_at__isnull=True)
        return qs

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response({"data": NotificationSerializer(notification).data, "errors": None, "meta": None})

    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request):
        count = Notification.objects.filter(
            user=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({"data": {"marked_read": count}, "errors": None, "meta": None})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"data": {"count": count}, "errors": None, "meta": None})
