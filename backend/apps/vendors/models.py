from django.db import models
from apps.core.models import TimeStampedModel


class Vendor(TimeStampedModel):
    class Type(models.TextChoices):
        SUPPLIER = "supplier", "Supplier"
        MANUFACTURER = "manufacturer", "Manufacturer"
        FREIGHT_FORWARDER = "freight_forwarder", "Freight Forwarder"
        CARRIER = "carrier", "Carrier"

    class PaymentMethod(models.TextChoices):
        WIRE = "wire", "Wire Transfer"
        ACH = "ach", "ACH"
        CHECK = "check", "Check"
        CARD = "card", "Credit Card"

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=30, choices=Type.choices)
    primary_contact_name = models.CharField(max_length=255, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=50, blank=True)
    additional_contacts = models.JSONField(default=list, blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    preferred_payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, blank=True
    )
    website = models.URLField(blank=True)
    portal_notes = models.TextField(blank=True)
    performance_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        pass

    def __str__(self):
        return self.name
