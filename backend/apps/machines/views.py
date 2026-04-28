from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import AuditMixin, EnvelopeMixin
from apps.core.pagination import StandardPagination
from apps.users.permissions import IsAdminOrReadOnly
from .models import Machine
from .serializers import MachineSerializer


class MachineViewSet(EnvelopeMixin, AuditMixin, viewsets.ModelViewSet):
    serializer_class = MachineSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = StandardPagination
    ordering = ["name"]

    def get_queryset(self):
        return Machine.objects.filter(is_active=True).select_related("manufacturer")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])

    @action(detail=True, methods=["get"])
    def items(self, request, pk=None):
        machine = self.get_object()
        from apps.inventory.models import InventoryItem
        from apps.inventory.serializers import InventoryItemSerializer
        qs = InventoryItem.objects.filter(machine=machine, is_active=True)
        return Response({"data": InventoryItemSerializer(qs, many=True).data, "errors": None, "meta": None})
