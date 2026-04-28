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
