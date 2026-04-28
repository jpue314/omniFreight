from celery import shared_task


@shared_task
def check_deadlines():
    """Daily task: notify all active users about deadline and overdue reorder items."""
    from datetime import date, timedelta
    from decimal import Decimal
    from django.db.models import Sum, F
    from apps.inventory.models import InventoryItem, InventoryTransaction
    from apps.notifications.models import notify, Notification
    from apps.users.models import User

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    active_users = list(User.objects.filter(is_active=True))

    low_stock = InventoryItem.objects.filter(
        is_active=True,
        current_quantity__lte=F("min_stock_level"),
    ).select_related("vendor")

    for item in low_stock:
        consumption = item.transactions.filter(
            type=InventoryTransaction.Type.CONSUMPTION,
            created_at__date__gte=thirty_days_ago,
        ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")

        avg_daily = abs(consumption) / 30
        days_until_out = int(item.current_quantity / avg_daily) if avg_daily > 0 else 0
        order_by = today + timedelta(days=max(0, days_until_out - item.lead_time_days))
        vendor_name = item.vendor.name if item.vendor else "Unknown vendor"

        if order_by == today:
            for user in active_users:
                notify(
                    user=user,
                    type=Notification.Type.DEADLINE,
                    message=f"Order {item.name} from {vendor_name} today — {item.lead_time_days} day lead time",
                    link="/reorder",
                )
        elif order_by < today:
            days_late = (today - order_by).days
            for user in active_users:
                notify(
                    user=user,
                    type=Notification.Type.OVERDUE,
                    message=f"Overdue: {item.name} should have been ordered {days_late} day(s) ago",
                    link="/reorder",
                )
