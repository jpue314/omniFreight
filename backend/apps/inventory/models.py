import uuid
from django.conf import settings
from django.db import models
from apps.core.models import TimeStampedModel


class InventoryItem(TimeStampedModel):
    class Category(models.TextChoices):
        INK = "ink", "Ink"
        SPARE_PART = "spare_part", "Spare Part"
        RAW_MATERIAL = "raw_material", "Raw Material"
        PACKAGING = "packaging", "Packaging"
        OTHER = "other", "Other"

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    sku = models.CharField(max_length=100, blank=True)
    unit_of_measure = models.CharField(max_length=50)
    current_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    min_stock_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reorder_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vendor = models.ForeignKey(
        "vendors.Vendor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="items",
    )
    reorder_url = models.URLField(blank=True)
    lead_time_days = models.PositiveIntegerField(default=7)
    last_ordered_date = models.DateField(null=True, blank=True)
    machine = models.ForeignKey(
        "machines.Machine",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="items",
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        pass

    def __str__(self):
        return f"{self.name} ({self.current_quantity} {self.unit_of_measure})"

    @property
    def is_low_stock(self):
        return self.current_quantity <= self.min_stock_level


class InventoryTransaction(models.Model):
    class Type(models.TextChoices):
        RECEIPT = "receipt", "Receipt"
        CONSUMPTION = "consumption", "Consumption"
        ADJUSTMENT = "adjustment", "Adjustment"
        RETURN = "return", "Return"
        INITIAL = "initial", "Initial Count"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    quantity_before = models.DecimalField(max_digits=12, decimal_places=3)
    quantity_after = models.DecimalField(max_digits=12, decimal_places=3)
    reference = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.quantity} {self.item.unit_of_measure} — {self.item.name}"
