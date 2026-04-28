import pytest
from decimal import Decimal
from django.db import transaction
from tests.inventory.factories import InventoryItemFactory
from apps.inventory.services import record_transaction
from apps.inventory.models import InventoryTransaction


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


@pytest.mark.django_db
def test_record_receipt_updates_quantity(staff_user):
    item = InventoryItemFactory(current_quantity=Decimal("5"))
    tx = record_transaction(
        item=item,
        type=InventoryTransaction.Type.RECEIPT,
        quantity=Decimal("10"),
        created_by=staff_user,
        reference="PO-001",
    )
    item.refresh_from_db()
    assert item.current_quantity == Decimal("15")
    assert tx.quantity_before == Decimal("5")
    assert tx.quantity_after == Decimal("15")


@pytest.mark.django_db
def test_record_consumption_reduces_quantity(staff_user):
    item = InventoryItemFactory(current_quantity=Decimal("10"))
    tx = record_transaction(
        item=item,
        type=InventoryTransaction.Type.CONSUMPTION,
        quantity=Decimal("-3"),
        created_by=staff_user,
    )
    item.refresh_from_db()
    assert item.current_quantity == Decimal("7")
    assert tx.quantity_after == Decimal("7")


@pytest.mark.django_db
def test_record_transaction_is_atomic(staff_user):
    item = InventoryItemFactory(current_quantity=Decimal("5"))
    original_qty = item.current_quantity
    try:
        with transaction.atomic():
            record_transaction(
                item=item,
                type=InventoryTransaction.Type.RECEIPT,
                quantity=Decimal("10"),
                created_by=staff_user,
            )
            raise ValueError("Simulated failure")
    except ValueError:
        pass
    item.refresh_from_db()
    assert item.current_quantity == original_qty
    assert item.transactions.count() == 0


@pytest.mark.django_db
def test_list_inventory_requires_auth(client):
    response = client.get("/api/v1/inventory/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_inventory(staff_client):
    InventoryItemFactory.create_batch(3)
    response = staff_client.get("/api/v1/inventory/")
    assert response.status_code == 200
    assert response.json()["meta"]["count"] == 3


@pytest.mark.django_db
def test_filter_low_stock(staff_client):
    InventoryItemFactory(current_quantity=Decimal("2"), min_stock_level=Decimal("5"))
    InventoryItemFactory(current_quantity=Decimal("10"), min_stock_level=Decimal("5"))
    response = staff_client.get("/api/v1/inventory/?low_stock=true")
    assert response.json()["meta"]["count"] == 1


@pytest.mark.django_db
def test_create_item_admin_only(staff_client):
    response = staff_client.post(
        "/api/v1/inventory/",
        {"name": "Ink", "unit_of_measure": "L"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_record_transaction_via_api(staff_client):
    item = InventoryItemFactory(current_quantity=Decimal("0"))
    response = staff_client.post(
        f"/api/v1/inventory/{item.id}/transactions/",
        {"type": "receipt", "quantity": "10.000", "reference": "PO-123"},
        format="json",
    )
    assert response.status_code == 201
    item.refresh_from_db()
    assert item.current_quantity == Decimal("10")


@pytest.mark.django_db
def test_transaction_history(staff_client, staff_user):
    item = InventoryItemFactory()
    record_transaction(item=item, type="receipt", quantity=Decimal("5"), created_by=staff_user)
    response = staff_client.get(f"/api/v1/inventory/{item.id}/transactions/")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 1


@pytest.mark.django_db
def test_mark_ordered(staff_client):
    item = InventoryItemFactory(last_ordered_date=None)
    response = staff_client.post(f"/api/v1/inventory/{item.id}/mark-ordered/")
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.last_ordered_date is not None
