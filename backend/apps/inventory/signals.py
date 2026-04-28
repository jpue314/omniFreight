from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="inventory.InventoryTransaction")
def check_low_stock_on_transaction(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.type not in (
        instance.Type.CONSUMPTION,
        instance.Type.ADJUSTMENT,
    ):
        return

    item = instance.item
    if item.current_quantity > item.min_stock_level:
        return

    from apps.notifications.models import notify, Notification
    from apps.users.models import User

    vendor_name = item.vendor.name if item.vendor_id else "Unknown vendor"
    message = (
        f"{item.name} is low — {item.current_quantity} {item.unit_of_measure} remaining "
        f"(min: {item.min_stock_level}). Vendor: {vendor_name}"
    )
    for user in User.objects.filter(is_active=True):
        notify(user=user, type=Notification.Type.LOW_STOCK, message=message, link=f"/inventory/{item.id}")
