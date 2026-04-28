import factory
from apps.vendors.models import Vendor


class VendorFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Vendor

    name = factory.Sequence(lambda n: f"Vendor {n}")
    type = Vendor.Type.SUPPLIER
    primary_contact_name = "Jane Smith"
    primary_contact_email = factory.LazyAttribute(
        lambda o: f"contact@{o.name.lower().replace(' ', '')}.com"
    )
    primary_contact_phone = "555-0100"
    payment_terms = "Net 30"
