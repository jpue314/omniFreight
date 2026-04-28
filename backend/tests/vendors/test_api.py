import pytest
from tests.vendors.factories import VendorFactory


@pytest.mark.django_db
def test_vendor_str():
    vendor = VendorFactory(name="Roland DG")
    assert str(vendor) == "Roland DG"


@pytest.mark.django_db
def test_vendor_soft_delete_flag():
    vendor = VendorFactory()
    assert vendor.is_active is True
    vendor.is_active = False
    vendor.save()
    vendor.refresh_from_db()
    assert vendor.is_active is False


@pytest.mark.django_db
def test_list_vendors_requires_auth(client):
    response = client.get("/api/v1/vendors/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_vendors_staff(staff_client):
    VendorFactory.create_batch(3)
    response = staff_client.get("/api/v1/vendors/")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["count"] == 3
    assert body["errors"] is None


@pytest.mark.django_db
def test_list_vendors_excludes_inactive(staff_client):
    VendorFactory(is_active=True)
    VendorFactory(is_active=False)
    response = staff_client.get("/api/v1/vendors/")
    assert response.json()["meta"]["count"] == 1


@pytest.mark.django_db
def test_create_vendor_forbidden_for_staff(staff_client):
    response = staff_client.post(
        "/api/v1/vendors/", {"name": "Test", "type": "supplier"}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_vendor_admin(admin_client, admin_user):
    response = admin_client.post(
        "/api/v1/vendors/",
        {"name": "Roland DG", "type": "supplier", "payment_terms": "Net 30"},
        format="json",
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Roland DG"
    assert data["created_by"] == str(admin_user.id)


@pytest.mark.django_db
def test_soft_delete_vendor(admin_client):
    vendor = VendorFactory()
    response = admin_client.delete(f"/api/v1/vendors/{vendor.id}/")
    assert response.status_code == 204
    vendor.refresh_from_db()
    assert vendor.is_active is False


@pytest.mark.django_db
def test_filter_vendors_by_type(staff_client):
    VendorFactory(type="supplier")
    VendorFactory(type="carrier")
    response = staff_client.get("/api/v1/vendors/?type=supplier")
    assert response.json()["meta"]["count"] == 1
