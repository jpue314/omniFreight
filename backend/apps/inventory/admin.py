from django.contrib import admin
from .models import InventoryItem, InventoryTransaction


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "current_quantity", "min_stock_level", "vendor", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["name", "sku"]


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ["item", "type", "quantity", "quantity_before", "quantity_after", "created_by", "created_at"]
    list_filter = ["type"]
    readonly_fields = ["quantity_before", "quantity_after", "created_at"]
