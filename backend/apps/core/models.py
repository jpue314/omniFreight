import uuid
from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base for every business entity in omniFreight.

    Provides UUID primary key and full audit trail (who + when created/updated).
    All feature models (Vendor, Inventory, Shipment, etc.) must inherit from this.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_updated",
    )

    class Meta:
        abstract = True
        ordering = ["-created_at"]
