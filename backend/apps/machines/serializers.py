from rest_framework import serializers
from .models import Machine


class MachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Machine
        fields = [
            "id", "name", "asset_id", "type", "make", "model", "serial_number",
            "manufacturer", "purchase_date", "purchase_price", "warranty_expiration",
            "support_contact_name", "support_contact_phone", "support_contact_email",
            "network_config", "service_notes", "is_active",
            "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
