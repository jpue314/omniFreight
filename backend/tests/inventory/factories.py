import factory
from decimal import Decimal
from apps.inventory.models import InventoryItem, InventoryTransaction


class InventoryItemFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = InventoryItem

    name = factory.Sequence(lambda n: f"Item {n}")
    category = InventoryItem.Category.OTHER
    unit_of_measure = "units"
    current_quantity = Decimal("10.000")
    min_stock_level = Decimal("5.000")
    reorder_quantity = Decimal("20.000")
    unit_cost = Decimal("9.99")
    lead_time_days = 7
