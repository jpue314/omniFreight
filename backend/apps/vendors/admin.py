from django.contrib import admin
from .models import Vendor


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ["name", "type", "primary_contact_name", "primary_contact_email", "is_active"]
    list_filter = ["type", "is_active"]
    search_fields = ["name", "primary_contact_name", "primary_contact_email"]
