import uuid
from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        LOW_STOCK = "low_stock", "Low Stock"
        DEADLINE = "deadline", "Deadline"
        PAYMENT_DUE = "payment_due", "Payment Due"
        OVERDUE = "overdue", "Overdue"
        INFO = "info", "Info"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.INFO)
    message = models.CharField(max_length=500)
    link = models.CharField(max_length=500, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_read(self):
        return self.read_at is not None


def notify(user, type, message, link=""):
    """Create a notification for a user. Call this from Celery tasks and signals."""
    return Notification.objects.create(user=user, type=type, message=message, link=link)
