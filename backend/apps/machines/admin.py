from django.contrib import admin
from .models import Machine


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ["name", "asset_id", "type", "make", "model", "warranty_expiration", "is_active"]
    list_filter = ["type", "is_active"]
    search_fields = ["name", "asset_id", "serial_number"]
