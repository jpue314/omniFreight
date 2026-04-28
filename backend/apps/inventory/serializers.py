from rest_framework import serializers
from .models import InventoryItem, InventoryTransaction


class InventoryTransactionSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = [
            "id", "type", "quantity", "quantity_before", "quantity_after",
            "reference", "notes", "created_at", "created_by", "created_by_email",
        ]
        read_only_fields = ["id", "quantity_before", "quantity_after", "created_at", "created_by", "created_by_email"]


class InventoryItemSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "category", "sku", "unit_of_measure",
            "current_quantity", "min_stock_level", "reorder_quantity", "unit_cost",
            "vendor", "reorder_url", "lead_time_days", "last_ordered_date",
            "machine", "notes", "is_active", "is_low_stock",
            "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "current_quantity", "created_at", "updated_at", "created_by", "updated_by", "is_low_stock"]
