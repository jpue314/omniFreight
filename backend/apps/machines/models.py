from django.db import models
from apps.core.models import TimeStampedModel


class Machine(TimeStampedModel):
    class Type(models.TextChoices):
        PRINTER = "printer", "Printer"
        CUTTER = "cutter", "Cutter"
        LAMINATOR = "laminator", "Laminator"
        OTHER = "other", "Other"

    name = models.CharField(max_length=255)
    asset_id = models.CharField(max_length=100, blank=True)
    type = models.CharField(max_length=30, choices=Type.choices, default=Type.OTHER)
    make = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    manufacturer = models.ForeignKey(
        "vendors.Vendor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="machines",
    )
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    warranty_expiration = models.DateField(null=True, blank=True)
    support_contact_name = models.CharField(max_length=255, blank=True)
    support_contact_phone = models.CharField(max_length=50, blank=True)
    support_contact_email = models.EmailField(blank=True)
    network_config = models.JSONField(default=dict, blank=True)
    service_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        pass

    def __str__(self):
        return self.name
