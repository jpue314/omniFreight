from decimal import Decimal
from django.db import transaction as db_transaction
from .models import InventoryItem, InventoryTransaction


def record_transaction(item, type, quantity, created_by, reference="", notes=""):
    """Atomically create a transaction and update item.current_quantity.

    quantity: signed decimal — positive adds stock, negative removes stock.
    Returns the created InventoryTransaction.
    """
    with db_transaction.atomic():
        locked_item = InventoryItem.objects.select_for_update().get(pk=item.pk)
        quantity_before = locked_item.current_quantity
        quantity_after = quantity_before + Decimal(str(quantity))

        locked_item.current_quantity = quantity_after
        locked_item.save(update_fields=["current_quantity", "updated_at"])

        tx = InventoryTransaction.objects.create(
            item=locked_item,
            type=type,
            quantity=quantity,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            reference=reference,
            notes=notes,
            created_by=created_by,
        )
        return tx
