import pytest
from decimal import Decimal
from tests.inventory.factories import InventoryItemFactory


@pytest.mark.django_db
def test_item_str():
    item = InventoryItemFactory(name="Cyan Ink", current_quantity=Decimal("2.5"), unit_of_measure="L")
    assert "Cyan Ink" in str(item)
    assert "2.5" in str(item)


@pytest.mark.django_db
def test_is_low_stock_true():
    item = InventoryItemFactory(current_quantity=Decimal("2"), min_stock_level=Decimal("4"))
    assert item.is_low_stock is True


@pytest.mark.django_db
def test_is_low_stock_false():
    item = InventoryItemFactory(current_quantity=Decimal("10"), min_stock_level=Decimal("4"))
    assert item.is_low_stock is False
