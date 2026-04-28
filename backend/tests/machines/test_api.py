import pytest
from tests.machines.factories import MachineFactory


@pytest.mark.django_db
def test_machine_str():
    machine = MachineFactory(name="Printer 1 - Roland VG3")
    assert str(machine) == "Printer 1 - Roland VG3"


@pytest.mark.django_db
def test_machine_active_by_default():
    machine = MachineFactory()
    assert machine.is_active is True


@pytest.mark.django_db
def test_machine_soft_delete():
    machine = MachineFactory()
    machine.is_active = False
    machine.save()
    machine.refresh_from_db()
    assert machine.is_active is False


@pytest.mark.django_db
def test_list_machines_requires_auth(client):
    response = client.get("/api/v1/machines/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_machines(staff_client):
    MachineFactory.create_batch(2)
    response = staff_client.get("/api/v1/machines/")
    assert response.status_code == 200
    assert response.json()["meta"]["count"] == 2


@pytest.mark.django_db
def test_create_machine_admin_only(staff_client):
    response = staff_client.post(
        "/api/v1/machines/", {"name": "Test Machine", "type": "printer"}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_machine(admin_client):
    response = admin_client.post(
        "/api/v1/machines/",
        {"name": "Printer 1", "type": "printer", "make": "Roland", "model": "VG3"},
        format="json",
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Printer 1"
    assert data["make"] == "Roland"


@pytest.mark.django_db
def test_machine_items_endpoint_empty(staff_client):
    machine = MachineFactory()
    response = staff_client.get(f"/api/v1/machines/{machine.id}/items/")
    assert response.status_code == 200
    assert response.json()["data"] == []
