from rest_framework import serializers
from .models import Vendor


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = [
            "id", "name", "type", "primary_contact_name", "primary_contact_email",
            "primary_contact_phone", "additional_contacts", "payment_terms",
            "preferred_payment_method", "website", "portal_notes", "performance_notes",
            "is_active", "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
