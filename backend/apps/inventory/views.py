from datetime import date
from decimal import Decimal

from django.db.models import Sum, F
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.mixins import AuditMixin, EnvelopeMixin
from apps.core.pagination import StandardPagination
from apps.users.permissions import IsAdminOrReadOnly
from .models import InventoryItem, InventoryTransaction
from .serializers import InventoryItemSerializer, InventoryTransactionSerializer
from .services import record_transaction


class InventoryItemViewSet(EnvelopeMixin, AuditMixin, viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "sku"]
    ordering = ["name"]

    def get_queryset(self):
        qs = InventoryItem.objects.filter(is_active=True).select_related("vendor", "machine")
        if self.request.query_params.get("low_stock") == "true":
            qs = qs.filter(current_quantity__lte=F("min_stock_level"))
        if category := self.request.query_params.get("category"):
            qs = qs.filter(category=category)
        if vendor_id := self.request.query_params.get("vendor"):
            qs = qs.filter(vendor_id=vendor_id)
        if machine_id := self.request.query_params.get("machine"):
            qs = qs.filter(machine_id=machine_id)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])

    @action(detail=True, methods=["get", "post"], url_path="transactions")
    def transactions(self, request, pk=None):
        item = self.get_object()
        if request.method == "GET":
            txs = item.transactions.select_related("created_by").all()
            return Response({
                "data": InventoryTransactionSerializer(txs, many=True).data,
                "errors": None,
                "meta": {"count": txs.count()},
            })
        # POST
        serializer = InventoryTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tx = record_transaction(
            item=item,
            type=serializer.validated_data["type"],
            quantity=serializer.validated_data["quantity"],
            created_by=request.user,
            reference=serializer.validated_data.get("reference", ""),
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(
            {"data": InventoryTransactionSerializer(tx).data, "errors": None, "meta": None},
            status=201,
        )

    @action(detail=True, methods=["post"], url_path="mark-ordered")
    def mark_ordered(self, request, pk=None):
        item = self.get_object()
        item.last_ordered_date = date.today()
        item.updated_by = request.user
        item.save(update_fields=["last_ordered_date", "updated_by", "updated_at"])
        return Response({"data": InventoryItemSerializer(item).data, "errors": None, "meta": None})


class ReorderQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)

        low_stock = InventoryItem.objects.filter(
            is_active=True,
            current_quantity__lte=F("min_stock_level"),
        ).select_related("vendor")

        items_by_vendor = {}
        for item in low_stock:
            consumption = item.transactions.filter(
                type=InventoryTransaction.Type.CONSUMPTION,
                created_at__date__gte=thirty_days_ago,
            ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")

            avg_daily = abs(consumption) / 30
            days_until_out = int(item.current_quantity / avg_daily) if avg_daily > 0 else 0
            order_by = today + timedelta(days=max(0, days_until_out - item.lead_time_days))

            if order_by <= today:
                urgency = "red"
            elif order_by <= today + timedelta(days=3):
                urgency = "amber"
            else:
                urgency = "green"

            vid = str(item.vendor_id) if item.vendor_id else "unassigned"
            if vid not in items_by_vendor:
                items_by_vendor[vid] = {
                    "vendor_id": vid,
                    "vendor_name": item.vendor.name if item.vendor else "No vendor",
                    "vendor_phone": item.vendor.primary_contact_phone if item.vendor else "",
                    "vendor_payment_terms": item.vendor.payment_terms if item.vendor else "",
                    "items": [],
                }
            items_by_vendor[vid]["items"].append({
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "unit_of_measure": item.unit_of_measure,
                "current_quantity": str(item.current_quantity),
                "min_stock_level": str(item.min_stock_level),
                "reorder_quantity": str(item.reorder_quantity),
                "lead_time_days": item.lead_time_days,
                "reorder_url": item.reorder_url,
                "last_ordered_date": item.last_ordered_date.isoformat() if item.last_ordered_date else None,
                "order_by_date": order_by.isoformat(),
                "urgency": urgency,
            })

        return Response({
            "data": list(items_by_vendor.values()),
            "errors": None,
            "meta": {"total_low_stock": low_stock.count()},
        })
