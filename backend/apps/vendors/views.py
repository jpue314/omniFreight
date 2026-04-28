from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import AuditMixin
from apps.core.pagination import StandardPagination
from apps.users.permissions import IsAdminOrReadOnly
from .models import Vendor
from .serializers import VendorSerializer


class VendorViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "primary_contact_name", "primary_contact_email"]
    ordering_fields = ["name", "type", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Vendor.objects.filter(is_active=True)
        vendor_type = self.request.query_params.get("type")
        if vendor_type:
            qs = qs.filter(type=vendor_type)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])

    @action(detail=True, methods=["get"])
    def items(self, request, pk=None):
        vendor = self.get_object()
        from apps.inventory.models import InventoryItem
        from apps.inventory.serializers import InventoryItemSerializer
        qs = InventoryItem.objects.filter(vendor=vendor, is_active=True)
        return Response({"data": InventoryItemSerializer(qs, many=True).data, "errors": None, "meta": None})

    @action(detail=True, methods=["get"])
    def machines(self, request, pk=None):
        vendor = self.get_object()
        from apps.machines.models import Machine
        from apps.machines.serializers import MachineSerializer
        qs = Machine.objects.filter(manufacturer=vendor, is_active=True)
        return Response({"data": MachineSerializer(qs, many=True).data, "errors": None, "meta": None})
