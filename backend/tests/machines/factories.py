import factory
from apps.machines.models import Machine


class MachineFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Machine

    name = factory.Sequence(lambda n: f"Machine {n}")
    type = Machine.Type.PRINTER
    make = "Roland"
    model = factory.Sequence(lambda n: f"VG3-{n}")
    asset_id = factory.Sequence(lambda n: f"ASSET-{n:04d}")
