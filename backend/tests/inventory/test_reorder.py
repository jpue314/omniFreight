import pytest
from decimal import Decimal
from tests.vendors.factories import VendorFactory
from tests.inventory.factories import InventoryItemFactory
from apps.inventory.services import record_transaction
from apps.inventory.models import InventoryTransaction


@pytest.mark.django_db
def test_reorder_queue_empty_when_all_stocked(staff_client):
    InventoryItemFactory(current_quantity=Decimal("10"), min_stock_level=Decimal("5"))
    response = staff_client.get("/api/v1/reorder/")
    assert response.status_code == 200
    assert response.json()["data"] == []


@pytest.mark.django_db
def test_reorder_queue_shows_low_stock_items(staff_client):
    vendor = VendorFactory(name="Roland DG", primary_contact_phone="555-1234")
    InventoryItemFactory(
        current_quantity=Decimal("2"),
        min_stock_level=Decimal("5"),
        vendor=vendor,
        lead_time_days=7,
    )
    response = staff_client.get("/api/v1/reorder/")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["vendor_name"] == "Roland DG"
    assert len(data[0]["items"]) == 1


@pytest.mark.django_db
def test_reorder_queue_groups_by_vendor(staff_client):
    v1 = VendorFactory(name="Vendor A")
    v2 = VendorFactory(name="Vendor B")
    InventoryItemFactory(current_quantity=Decimal("1"), min_stock_level=Decimal("5"), vendor=v1)
    InventoryItemFactory(current_quantity=Decimal("1"), min_stock_level=Decimal("5"), vendor=v2)
    InventoryItemFactory(current_quantity=Decimal("1"), min_stock_level=Decimal("5"), vendor=v1)
    response = staff_client.get("/api/v1/reorder/")
    data = response.json()["data"]
    assert len(data) == 2
    vendor_a = next(d for d in data if d["vendor_name"] == "Vendor A")
    assert len(vendor_a["items"]) == 2


@pytest.mark.django_db
def test_reorder_queue_urgency_red_no_history(staff_client):
    InventoryItemFactory(
        current_quantity=Decimal("1"),
        min_stock_level=Decimal("5"),
        lead_time_days=7,
    )
    response = staff_client.get("/api/v1/reorder/")
    item = response.json()["data"][0]["items"][0]
    assert item["urgency"] == "red"
