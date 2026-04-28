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
