# Vendor, Inventory & Machine — Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete REST API for Vendor Management, Inventory (with transaction ledger and atomic quantity updates), Machine Registry, and Reorder Queue — including Celery tasks for deadline alerts and Django signals for low-stock notifications.

**Architecture:** Three Django apps (`vendors`, `machines`, `inventory`) all inheriting `TimeStampedModel`. Stock changes go through `record_transaction()` which atomically updates `InventoryItem.current_quantity` and creates an immutable `InventoryTransaction` ledger entry. Reorder Queue is a computed APIView — no stored model.

**Tech Stack:** Django 5.1, DRF 3.15, SimpleJWT, PostgreSQL 15, Celery 5.4 + Redis, pytest-django 4.9, factory-boy 3.3

---

## File Map

**Create:**
```
backend/apps/vendors/__init__.py
backend/apps/vendors/apps.py
backend/apps/vendors/models.py
backend/apps/vendors/serializers.py
backend/apps/vendors/views.py
backend/apps/vendors/urls.py
backend/apps/vendors/admin.py
backend/apps/vendors/migrations/__init__.py

backend/apps/machines/__init__.py
backend/apps/machines/apps.py
backend/apps/machines/models.py
backend/apps/machines/serializers.py
backend/apps/machines/views.py
backend/apps/machines/urls.py
backend/apps/machines/admin.py
backend/apps/machines/migrations/__init__.py

backend/apps/inventory/__init__.py
backend/apps/inventory/apps.py
backend/apps/inventory/models.py
backend/apps/inventory/services.py
backend/apps/inventory/serializers.py
backend/apps/inventory/views.py
backend/apps/inventory/urls.py
backend/apps/inventory/admin.py
backend/apps/inventory/tasks.py
backend/apps/inventory/signals.py
backend/apps/inventory/migrations/__init__.py

backend/tests/__init__.py
backend/tests/conftest.py
backend/tests/vendors/__init__.py
backend/tests/vendors/factories.py
backend/tests/vendors/test_api.py
backend/tests/machines/__init__.py
backend/tests/machines/factories.py
backend/tests/machines/test_api.py
backend/tests/inventory/__init__.py
backend/tests/inventory/factories.py
backend/tests/inventory/test_api.py
backend/tests/inventory/test_reorder.py
```

**Modify:**
```
backend/config/settings/base.py   — LOCAL_APPS + CELERY_BEAT_SCHEDULE
backend/config/urls.py            — add vendor/inventory/machine/reorder routes
```

---

## Task 1: Test Infrastructure

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create `backend/tests/__init__.py`** (empty file)

- [ ] **Step 2: Create `backend/tests/conftest.py`**

```python
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture
def admin_user(db):
    from apps.users.models import User
    return User.objects.create_user(
        email="admin@test.com",
        password="testpass123",
        role="admin",
        is_staff=True,
        is_superuser=True,
    )


@pytest.fixture
def staff_user(db):
    from apps.users.models import User
    return User.objects.create_user(
        email="staff@test.com",
        password="testpass123",
        role="staff",
    )


@pytest.fixture
def admin_client(db, admin_user):
    client = APIClient()
    refresh = RefreshToken.for_user(admin_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def staff_client(db, staff_user):
    client = APIClient()
    refresh = RefreshToken.for_user(staff_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client
```

- [ ] **Step 3: Verify pytest config is correct**

```bash
docker-compose exec backend pytest tests/ --collect-only 2>&1 | head -20
```
Expected: `no tests ran` (no errors, just no tests yet)

- [ ] **Step 4: Commit**
```bash
git add backend/tests/
git commit -m "test: add pytest fixtures for admin and staff API clients"
```

---

## Task 2: Vendor Model

**Files:**
- Create: `backend/apps/vendors/__init__.py`
- Create: `backend/apps/vendors/apps.py`
- Create: `backend/apps/vendors/models.py`
- Create: `backend/apps/vendors/migrations/__init__.py`
- Create: `backend/tests/vendors/__init__.py`
- Create: `backend/tests/vendors/factories.py`
- Create: `backend/tests/vendors/test_api.py` (model tests only for now)

- [ ] **Step 1: Write failing model test**

Create `backend/tests/vendors/test_api.py`:
```python
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
```

- [ ] **Step 2: Run to verify it fails**
```bash
docker-compose exec backend pytest tests/vendors/test_api.py -v 2>&1
```
Expected: `ModuleNotFoundError` — apps.vendors doesn't exist yet

- [ ] **Step 3: Create `backend/apps/vendors/__init__.py`** (empty)

- [ ] **Step 4: Create `backend/apps/vendors/apps.py`**
```python
from django.apps import AppConfig


class VendorsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.vendors"
    label = "vendors"
```

- [ ] **Step 5: Create `backend/apps/vendors/models.py`**
```python
from django.db import models
from apps.core.models import TimeStampedModel


class Vendor(TimeStampedModel):
    class Type(models.TextChoices):
        SUPPLIER = "supplier", "Supplier"
        MANUFACTURER = "manufacturer", "Manufacturer"
        FREIGHT_FORWARDER = "freight_forwarder", "Freight Forwarder"
        CARRIER = "carrier", "Carrier"

    class PaymentMethod(models.TextChoices):
        WIRE = "wire", "Wire Transfer"
        ACH = "ach", "ACH"
        CHECK = "check", "Check"
        CARD = "card", "Credit Card"

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=30, choices=Type.choices)
    primary_contact_name = models.CharField(max_length=255, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=50, blank=True)
    additional_contacts = models.JSONField(default=list, blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    preferred_payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, blank=True
    )
    website = models.URLField(blank=True)
    portal_notes = models.TextField(blank=True)
    performance_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        pass

    def __str__(self):
        return self.name
```

- [ ] **Step 6: Create `backend/apps/vendors/migrations/__init__.py`** (empty)

- [ ] **Step 7: Create `backend/tests/vendors/__init__.py`** (empty)

- [ ] **Step 8: Create `backend/tests/vendors/factories.py`**
```python
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
```

- [ ] **Step 9: Add `apps.vendors` to INSTALLED_APPS in `backend/config/settings/base.py`**

```python
LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.notifications",
    "apps.vendors",      # add this
]
```

- [ ] **Step 10: Generate and run migration**
```bash
docker-compose exec backend python manage.py makemigrations vendors
docker-compose exec backend python manage.py migrate
```
Expected: `Applying vendors.0001_initial... OK`

- [ ] **Step 11: Run tests — verify they pass**
```bash
docker-compose exec backend pytest tests/vendors/test_api.py -v 2>&1
```
Expected: `2 passed`

- [ ] **Step 12: Commit**
```bash
git add backend/apps/vendors/ backend/tests/vendors/ backend/config/settings/base.py
git commit -m "feat: add Vendor model with soft delete"
```

---

## Task 3: Vendor API (Serializers, Views, URLs)

**Files:**
- Create: `backend/apps/vendors/serializers.py`
- Create: `backend/apps/vendors/views.py`
- Create: `backend/apps/vendors/urls.py`
- Create: `backend/apps/vendors/admin.py`
- Modify: `backend/tests/vendors/test_api.py` — add API tests

- [ ] **Step 1: Add API tests to `backend/tests/vendors/test_api.py`**

Replace the file contents with:
```python
import pytest
from tests.vendors.factories import VendorFactory


@pytest.mark.django_db
def test_vendor_str():
    vendor = VendorFactory(name="Roland DG")
    assert str(vendor) == "Roland DG"


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
```

- [ ] **Step 2: Run to verify tests fail**
```bash
docker-compose exec backend pytest tests/vendors/test_api.py -v -k "not test_vendor_str and not test_soft_delete_flag" 2>&1
```
Expected: errors about missing URLs / 404s

- [ ] **Step 3: Create `backend/apps/vendors/serializers.py`**
```python
from rest_framework import serializers
from .models import Vendor


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = [
            "id", "name", "type", "primary_contact_name", "primary_contact_email",
            "primary_contact_phone", "additional_contacts", "payment_terms",
            "preferred_payment_method", "website", "portal_notes", "performance_notes",
            "is_active", "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
```

- [ ] **Step 4: Create `backend/apps/vendors/views.py`**
```python
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import AuditMixin
from apps.core.pagination import StandardPagination
from apps.users.permissions import IsAdminOrReadOnly
from .models import Vendor
from .serializers import VendorSerializer


class VendorViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "primary_contact_name", "primary_contact_email"]
    ordering_fields = ["name", "type", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Vendor.objects.filter(is_active=True)
        vendor_type = self.request.query_params.get("type")
        if vendor_type:
            qs = qs.filter(type=vendor_type)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])

    @action(detail=True, methods=["get"])
    def items(self, request, pk=None):
        vendor = self.get_object()
        from apps.inventory.models import InventoryItem
        from apps.inventory.serializers import InventoryItemSerializer
        qs = InventoryItem.objects.filter(vendor=vendor, is_active=True)
        return Response({"data": InventoryItemSerializer(qs, many=True).data, "errors": None, "meta": None})

    @action(detail=True, methods=["get"])
    def machines(self, request, pk=None):
        vendor = self.get_object()
        from apps.machines.models import Machine
        from apps.machines.serializers import MachineSerializer
        qs = Machine.objects.filter(manufacturer=vendor, is_active=True)
        return Response({"data": MachineSerializer(qs, many=True).data, "errors": None, "meta": None})
```

- [ ] **Step 5: Create `backend/apps/vendors/urls.py`**
```python
from rest_framework.routers import DefaultRouter
from .views import VendorViewSet

router = DefaultRouter()
router.register(r"", VendorViewSet, basename="vendor")

urlpatterns = router.urls
```

- [ ] **Step 6: Create `backend/apps/vendors/admin.py`**
```python
from django.contrib import admin
from .models import Vendor


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ["name", "type", "primary_contact_name", "primary_contact_email", "is_active"]
    list_filter = ["type", "is_active"]
    search_fields = ["name", "primary_contact_name", "primary_contact_email"]
```

- [ ] **Step 7: Add vendors URL to `backend/config/urls.py`**

Replace the `v1` list:
```python
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)

v1 = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("users/", include("apps.users.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("vendors/", include("apps.vendors.urls")),
    path("health/", include("apps.users.health_urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(v1)),
]
```

- [ ] **Step 8: Run tests — verify they pass**
```bash
docker-compose exec backend pytest tests/vendors/test_api.py -v 2>&1
```
Expected: `9 passed`

- [ ] **Step 9: Commit**
```bash
git add backend/apps/vendors/ backend/config/urls.py backend/tests/vendors/
git commit -m "feat: add Vendor CRUD API with soft delete and type filter"
```

---

## Task 4: Machine Model

**Files:**
- Create: `backend/apps/machines/__init__.py`
- Create: `backend/apps/machines/apps.py`
- Create: `backend/apps/machines/models.py`
- Create: `backend/apps/machines/migrations/__init__.py`
- Create: `backend/tests/machines/__init__.py`
- Create: `backend/tests/machines/factories.py`
- Create: `backend/tests/machines/test_api.py`

- [ ] **Step 1: Write failing model test**

Create `backend/tests/machines/test_api.py`:
```python
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
```

- [ ] **Step 2: Run to verify it fails**
```bash
docker-compose exec backend pytest tests/machines/test_api.py -v 2>&1
```
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create `backend/apps/machines/__init__.py`** (empty)

- [ ] **Step 4: Create `backend/apps/machines/apps.py`**
```python
from django.apps import AppConfig


class MachinesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.machines"
    label = "machines"
```

- [ ] **Step 5: Create `backend/apps/machines/models.py`**
```python
from django.db import models
from apps.core.models import TimeStampedModel


class Machine(TimeStampedModel):
    class Type(models.TextChoices):
        PRINTER = "printer", "Printer"
        CUTTER = "cutter", "Cutter"
        LAMINATOR = "laminator", "Laminator"
        OTHER = "other", "Other"

    name = models.CharField(max_length=255)
    asset_id = models.CharField(max_length=100, blank=True)
    type = models.CharField(max_length=30, choices=Type.choices, default=Type.OTHER)
    make = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    manufacturer = models.ForeignKey(
        "vendors.Vendor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="machines",
    )
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    warranty_expiration = models.DateField(null=True, blank=True)
    support_contact_name = models.CharField(max_length=255, blank=True)
    support_contact_phone = models.CharField(max_length=50, blank=True)
    support_contact_email = models.EmailField(blank=True)
    network_config = models.JSONField(default=dict, blank=True)
    service_notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        pass

    def __str__(self):
        return self.name
```

- [ ] **Step 6: Create `backend/apps/machines/migrations/__init__.py`** (empty)

- [ ] **Step 7: Create `backend/tests/machines/__init__.py`** (empty)

- [ ] **Step 8: Create `backend/tests/machines/factories.py`**
```python
import factory
from apps.machines.models import Machine


class MachineFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Machine

    name = factory.Sequence(lambda n: f"Machine {n}")
    type = Machine.Type.PRINTER
    make = "Roland"
    model = "VG3-640"
    asset_id = factory.Sequence(lambda n: f"ASSET-{n:04d}")
```

- [ ] **Step 9: Add `apps.machines` to INSTALLED_APPS in `backend/config/settings/base.py`**
```python
LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.notifications",
    "apps.vendors",
    "apps.machines",     # add this
]
```

- [ ] **Step 10: Generate and run migration**
```bash
docker-compose exec backend python manage.py makemigrations machines
docker-compose exec backend python manage.py migrate
```
Expected: `Applying machines.0001_initial... OK`

- [ ] **Step 11: Run tests — verify they pass**
```bash
docker-compose exec backend pytest tests/machines/test_api.py -v 2>&1
```
Expected: `2 passed`

- [ ] **Step 12: Commit**
```bash
git add backend/apps/machines/ backend/tests/machines/ backend/config/settings/base.py
git commit -m "feat: add Machine model"
```

---

## Task 5: Machine API

**Files:**
- Create: `backend/apps/machines/serializers.py`
- Create: `backend/apps/machines/views.py`
- Create: `backend/apps/machines/urls.py`
- Create: `backend/apps/machines/admin.py`
- Modify: `backend/tests/machines/test_api.py`
- Modify: `backend/config/urls.py`

- [ ] **Step 1: Add API tests — append to `backend/tests/machines/test_api.py`**
```python
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
    assert response.json()["data"]["name"] == "Printer 1"


@pytest.mark.django_db
def test_machine_items_endpoint(staff_client):
    machine = MachineFactory()
    response = staff_client.get(f"/api/v1/machines/{machine.id}/items/")
    assert response.status_code == 200
    assert response.json()["data"] == []
```

- [ ] **Step 2: Run to verify they fail**
```bash
docker-compose exec backend pytest tests/machines/ -v -k "not test_machine_str and not test_machine_active" 2>&1
```
Expected: 404/connection errors

- [ ] **Step 3: Create `backend/apps/machines/serializers.py`**
```python
from rest_framework import serializers
from .models import Machine


class MachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Machine
        fields = [
            "id", "name", "asset_id", "type", "make", "model", "serial_number",
            "manufacturer", "purchase_date", "purchase_price", "warranty_expiration",
            "support_contact_name", "support_contact_phone", "support_contact_email",
            "network_config", "service_notes", "is_active",
            "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
```

- [ ] **Step 4: Create `backend/apps/machines/views.py`**
```python
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import AuditMixin
from apps.core.pagination import StandardPagination
from apps.users.permissions import IsAdminOrReadOnly
from .models import Machine
from .serializers import MachineSerializer


class MachineViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = MachineSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = StandardPagination
    ordering = ["name"]

    def get_queryset(self):
        return Machine.objects.filter(is_active=True).select_related("manufacturer")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])

    @action(detail=True, methods=["get"])
    def items(self, request, pk=None):
        machine = self.get_object()
        from apps.inventory.models import InventoryItem
        from apps.inventory.serializers import InventoryItemSerializer
        qs = InventoryItem.objects.filter(machine=machine, is_active=True)
        return Response({"data": InventoryItemSerializer(qs, many=True).data, "errors": None, "meta": None})
```

- [ ] **Step 5: Create `backend/apps/machines/urls.py`**
```python
from rest_framework.routers import DefaultRouter
from .views import MachineViewSet

router = DefaultRouter()
router.register(r"", MachineViewSet, basename="machine")

urlpatterns = router.urls
```

- [ ] **Step 6: Create `backend/apps/machines/admin.py`**
```python
from django.contrib import admin
from .models import Machine


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ["name", "asset_id", "type", "make", "model", "warranty_expiration", "is_active"]
    list_filter = ["type", "is_active"]
    search_fields = ["name", "asset_id", "serial_number"]
```

- [ ] **Step 7: Add machines to `backend/config/urls.py`**

Replace the `v1` list:
```python
v1 = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("users/", include("apps.users.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("vendors/", include("apps.vendors.urls")),
    path("machines/", include("apps.machines.urls")),
    path("health/", include("apps.users.health_urls")),
]
```

- [ ] **Step 8: Run tests**
```bash
docker-compose exec backend pytest tests/machines/ -v 2>&1
```
Expected: `7 passed`

- [ ] **Step 9: Commit**
```bash
git add backend/apps/machines/ backend/config/urls.py backend/tests/machines/
git commit -m "feat: add Machine CRUD API"
```

---

## Task 6: Inventory Models

**Files:**
- Create: `backend/apps/inventory/__init__.py`
- Create: `backend/apps/inventory/apps.py`
- Create: `backend/apps/inventory/models.py`
- Create: `backend/apps/inventory/migrations/__init__.py`
- Create: `backend/tests/inventory/__init__.py`
- Create: `backend/tests/inventory/factories.py`
- Create: `backend/tests/inventory/test_api.py` (model tests only)

- [ ] **Step 1: Write failing model tests**

Create `backend/tests/inventory/test_api.py`:
```python
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
```

- [ ] **Step 2: Run to verify they fail**
```bash
docker-compose exec backend pytest tests/inventory/test_api.py -v 2>&1
```
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create `backend/apps/inventory/__init__.py`** (empty)

- [ ] **Step 4: Create `backend/apps/inventory/apps.py`**
```python
from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inventory"
    label = "inventory"

    def ready(self):
        import apps.inventory.signals  # noqa: F401
```

- [ ] **Step 5: Create `backend/apps/inventory/models.py`**
```python
import uuid
from django.conf import settings
from django.db import models
from apps.core.models import TimeStampedModel


class InventoryItem(TimeStampedModel):
    class Category(models.TextChoices):
        INK = "ink", "Ink"
        SPARE_PART = "spare_part", "Spare Part"
        RAW_MATERIAL = "raw_material", "Raw Material"
        PACKAGING = "packaging", "Packaging"
        OTHER = "other", "Other"

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    sku = models.CharField(max_length=100, blank=True)
    unit_of_measure = models.CharField(max_length=50)
    current_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    min_stock_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reorder_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vendor = models.ForeignKey(
        "vendors.Vendor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="items",
    )
    reorder_url = models.URLField(blank=True)
    lead_time_days = models.PositiveIntegerField(default=7)
    last_ordered_date = models.DateField(null=True, blank=True)
    machine = models.ForeignKey(
        "machines.Machine",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="items",
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        pass

    def __str__(self):
        return f"{self.name} ({self.current_quantity} {self.unit_of_measure})"

    @property
    def is_low_stock(self):
        return self.current_quantity <= self.min_stock_level


class InventoryTransaction(models.Model):
    class Type(models.TextChoices):
        RECEIPT = "receipt", "Receipt"
        CONSUMPTION = "consumption", "Consumption"
        ADJUSTMENT = "adjustment", "Adjustment"
        RETURN = "return", "Return"
        INITIAL = "initial", "Initial Count"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    quantity_before = models.DecimalField(max_digits=12, decimal_places=3)
    quantity_after = models.DecimalField(max_digits=12, decimal_places=3)
    reference = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.quantity} {self.item.unit_of_measure} — {self.item.name}"
```

- [ ] **Step 6: Create `backend/apps/inventory/migrations/__init__.py`** (empty)

- [ ] **Step 7: Create `backend/tests/inventory/__init__.py`** (empty)

- [ ] **Step 8: Create `backend/tests/inventory/factories.py`**
```python
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


class InventoryTransactionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = InventoryTransaction

    item = factory.SubFactory(InventoryItemFactory)
    type = InventoryTransaction.Type.RECEIPT
    quantity = Decimal("10.000")
    quantity_before = Decimal("0.000")
    quantity_after = Decimal("10.000")
    created_by = factory.LazyFunction(lambda: __import__('apps.users.models', fromlist=['User']).User.objects.first())
```

- [ ] **Step 9: Add `apps.inventory` to INSTALLED_APPS in `backend/config/settings/base.py`**
```python
LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.notifications",
    "apps.vendors",
    "apps.machines",
    "apps.inventory",    # add this
]
```

- [ ] **Step 10: Create placeholder `backend/apps/inventory/signals.py`** (required by apps.py `ready()`)
```python
# signals wired in Task 10
```

- [ ] **Step 11: Generate and run migration**
```bash
docker-compose exec backend python manage.py makemigrations inventory
docker-compose exec backend python manage.py migrate
```
Expected: `Applying inventory.0001_initial... OK`

- [ ] **Step 12: Run tests**
```bash
docker-compose exec backend pytest tests/inventory/test_api.py -v 2>&1
```
Expected: `3 passed`

- [ ] **Step 13: Commit**
```bash
git add backend/apps/inventory/ backend/tests/inventory/ backend/config/settings/base.py
git commit -m "feat: add InventoryItem and InventoryTransaction models"
```

---

## Task 7: Inventory Transaction Service (Atomic Quantity Update)

**Files:**
- Create: `backend/apps/inventory/services.py`
- Modify: `backend/tests/inventory/test_api.py` — add service tests

- [ ] **Step 1: Add service tests — append to `backend/tests/inventory/test_api.py`**
```python
from decimal import Decimal
from django.db import transaction
from apps.inventory.services import record_transaction
from apps.inventory.models import InventoryTransaction


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
```

- [ ] **Step 2: Run to verify they fail**
```bash
docker-compose exec backend pytest tests/inventory/test_api.py -k "record" -v 2>&1
```
Expected: `ImportError: cannot import name 'record_transaction'`

- [ ] **Step 3: Create `backend/apps/inventory/services.py`**
```python
from decimal import Decimal
from django.db import transaction as db_transaction
from .models import InventoryItem, InventoryTransaction


def record_transaction(item, type, quantity, created_by, reference="", notes=""):
    """Atomically create a transaction and update item.current_quantity.

    quantity: signed decimal — positive adds stock, negative removes stock.
    Returns the created InventoryTransaction.
    """
    with db_transaction.atomic():
        locked_item = InventoryItem.objects.select_for_update().get(pk=item.pk)
        quantity_before = locked_item.current_quantity
        quantity_after = quantity_before + Decimal(str(quantity))

        locked_item.current_quantity = quantity_after
        locked_item.save(update_fields=["current_quantity", "updated_at"])

        tx = InventoryTransaction.objects.create(
            item=locked_item,
            type=type,
            quantity=quantity,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            reference=reference,
            notes=notes,
            created_by=created_by,
        )
        return tx
```

- [ ] **Step 4: Run tests**
```bash
docker-compose exec backend pytest tests/inventory/test_api.py -k "record" -v 2>&1
```
Expected: `3 passed`

- [ ] **Step 5: Commit**
```bash
git add backend/apps/inventory/services.py backend/tests/inventory/test_api.py
git commit -m "feat: add atomic inventory transaction service"
```

---

## Task 8: Inventory API

**Files:**
- Create: `backend/apps/inventory/serializers.py`
- Create: `backend/apps/inventory/views.py`
- Create: `backend/apps/inventory/urls.py`
- Create: `backend/apps/inventory/admin.py`
- Modify: `backend/tests/inventory/test_api.py`
- Modify: `backend/config/urls.py`

- [ ] **Step 1: Add API tests — append to `backend/tests/inventory/test_api.py`**
```python
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
    InventoryItemFactory(current_quantity=Decimal("2"), min_stock_level=Decimal("5"))  # low
    InventoryItemFactory(current_quantity=Decimal("10"), min_stock_level=Decimal("5"))  # ok
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
def test_record_transaction_via_api(staff_client, staff_user):
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
```

- [ ] **Step 2: Run to verify they fail**
```bash
docker-compose exec backend pytest tests/inventory/test_api.py -k "api or list or filter or create or transaction or mark" -v 2>&1
```

- [ ] **Step 3: Create `backend/apps/inventory/serializers.py`**
```python
from rest_framework import serializers
from .models import InventoryItem, InventoryTransaction


class InventoryTransactionSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = [
            "id", "type", "quantity", "quantity_before", "quantity_after",
            "reference", "notes", "created_at", "created_by", "created_by_email",
        ]
        read_only_fields = ["id", "quantity_before", "quantity_after", "created_at", "created_by", "created_by_email"]


class InventoryItemSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id", "name", "category", "sku", "unit_of_measure",
            "current_quantity", "min_stock_level", "reorder_quantity", "unit_cost",
            "vendor", "reorder_url", "lead_time_days", "last_ordered_date",
            "machine", "notes", "is_active", "is_low_stock",
            "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "current_quantity", "created_at", "updated_at", "created_by", "updated_by", "is_low_stock"]
```

- [ ] **Step 4: Create `backend/apps/inventory/views.py`**
```python
from datetime import date
from decimal import Decimal

from django.db.models import Sum, F
from django.utils import timezone
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.mixins import AuditMixin
from apps.core.pagination import StandardPagination
from apps.users.permissions import IsAdminOrReadOnly
from .models import InventoryItem, InventoryTransaction
from .serializers import InventoryItemSerializer, InventoryTransactionSerializer
from .services import record_transaction


class InventoryItemViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "sku"]
    ordering = ["name"]

    def get_queryset(self):
        qs = InventoryItem.objects.filter(is_active=True).select_related("vendor", "machine")
        if self.request.query_params.get("low_stock") == "true":
            qs = qs.filter(current_quantity__lte=F("min_stock_level"))
        if category := self.request.query_params.get("category"):
            qs = qs.filter(category=category)
        if vendor_id := self.request.query_params.get("vendor"):
            qs = qs.filter(vendor_id=vendor_id)
        if machine_id := self.request.query_params.get("machine"):
            qs = qs.filter(machine_id=machine_id)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])

    @action(detail=True, methods=["get"])
    def transactions(self, request, pk=None):
        item = self.get_object()
        txs = item.transactions.select_related("created_by").all()
        return Response({
            "data": InventoryTransactionSerializer(txs, many=True).data,
            "errors": None,
            "meta": {"count": txs.count()},
        })

    @action(detail=True, methods=["post"])
    def transactions_create(self, request, pk=None):
        item = self.get_object()
        serializer = InventoryTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tx = record_transaction(
            item=item,
            type=serializer.validated_data["type"],
            quantity=serializer.validated_data["quantity"],
            created_by=request.user,
            reference=serializer.validated_data.get("reference", ""),
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(
            {"data": InventoryTransactionSerializer(tx).data, "errors": None, "meta": None},
            status=201,
        )

    @action(detail=True, methods=["post"], url_path="mark-ordered")
    def mark_ordered(self, request, pk=None):
        item = self.get_object()
        item.last_ordered_date = date.today()
        item.updated_by = request.user
        item.save(update_fields=["last_ordered_date", "updated_by", "updated_at"])
        return Response({"data": InventoryItemSerializer(item).data, "errors": None, "meta": None})


class ReorderQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)

        low_stock = InventoryItem.objects.filter(
            is_active=True,
            current_quantity__lte=F("min_stock_level"),
        ).select_related("vendor")

        items_by_vendor = {}
        for item in low_stock:
            consumption = item.transactions.filter(
                type=InventoryTransaction.Type.CONSUMPTION,
                created_at__date__gte=thirty_days_ago,
            ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")

            avg_daily = abs(consumption) / 30
            days_until_out = int(item.current_quantity / avg_daily) if avg_daily > 0 else 0
            order_by = today + timedelta(days=max(0, days_until_out - item.lead_time_days))

            if order_by <= today:
                urgency = "red"
            elif order_by <= today + timedelta(days=3):
                urgency = "amber"
            else:
                urgency = "green"

            vid = str(item.vendor_id) if item.vendor_id else "unassigned"
            if vid not in items_by_vendor:
                items_by_vendor[vid] = {
                    "vendor_id": vid,
                    "vendor_name": item.vendor.name if item.vendor else "No vendor",
                    "vendor_phone": item.vendor.primary_contact_phone if item.vendor else "",
                    "vendor_payment_terms": item.vendor.payment_terms if item.vendor else "",
                    "items": [],
                }
            items_by_vendor[vid]["items"].append({
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "unit_of_measure": item.unit_of_measure,
                "current_quantity": str(item.current_quantity),
                "min_stock_level": str(item.min_stock_level),
                "reorder_quantity": str(item.reorder_quantity),
                "lead_time_days": item.lead_time_days,
                "reorder_url": item.reorder_url,
                "last_ordered_date": item.last_ordered_date.isoformat() if item.last_ordered_date else None,
                "order_by_date": order_by.isoformat(),
                "urgency": urgency,
            })

        return Response({
            "data": list(items_by_vendor.values()),
            "errors": None,
            "meta": {"total_low_stock": low_stock.count()},
        })
```

- [ ] **Step 5: Create `backend/apps/inventory/urls.py`**

Note: `transactions/` uses a custom route because DRF router doesn't support nested actions with POST on the same path as GET. We wire them manually.

```python
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import InventoryItemViewSet, ReorderQueueView

router = DefaultRouter()
router.register(r"", InventoryItemViewSet, basename="inventory")

urlpatterns = router.urls + [
    path("<uuid:pk>/transactions/", InventoryItemViewSet.as_view({
        "get": "transactions",
        "post": "transactions_create",
    }), name="inventory-transactions"),
]
```

- [ ] **Step 6: Create `backend/apps/inventory/admin.py`**
```python
from django.contrib import admin
from .models import InventoryItem, InventoryTransaction


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "current_quantity", "min_stock_level", "vendor", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["name", "sku"]


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ["item", "type", "quantity", "quantity_before", "quantity_after", "created_by", "created_at"]
    list_filter = ["type"]
    readonly_fields = ["quantity_before", "quantity_after", "created_at"]
```

- [ ] **Step 7: Add inventory + reorder to `backend/config/urls.py`**
```python
from apps.inventory.views import ReorderQueueView

v1 = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("users/", include("apps.users.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("vendors/", include("apps.vendors.urls")),
    path("machines/", include("apps.machines.urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("reorder/", ReorderQueueView.as_view(), name="reorder-queue"),
    path("health/", include("apps.users.health_urls")),
]
```

- [ ] **Step 8: Run all inventory tests**
```bash
docker-compose exec backend pytest tests/inventory/test_api.py -v 2>&1
```
Expected: all pass

- [ ] **Step 9: Commit**
```bash
git add backend/apps/inventory/ backend/config/urls.py backend/tests/inventory/
git commit -m "feat: add Inventory CRUD API with transaction ledger and Reorder Queue"
```

---

## Task 9: Reorder Queue Tests

**Files:**
- Create: `backend/tests/inventory/test_reorder.py`

- [ ] **Step 1: Create `backend/tests/inventory/test_reorder.py`**
```python
import pytest
from decimal import Decimal
from datetime import date, timedelta
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
```

- [ ] **Step 2: Run tests**
```bash
docker-compose exec backend pytest tests/inventory/test_reorder.py -v 2>&1
```
Expected: `4 passed`

- [ ] **Step 3: Commit**
```bash
git add backend/tests/inventory/test_reorder.py
git commit -m "test: add reorder queue tests"
```

---

## Task 10: Celery Tasks and Django Signals

**Files:**
- Create: `backend/apps/inventory/tasks.py`
- Modify: `backend/apps/inventory/signals.py`
- Modify: `backend/config/settings/base.py` — add CELERY_BEAT_SCHEDULE

- [ ] **Step 1: Create `backend/apps/inventory/tasks.py`**
```python
from celery import shared_task


@shared_task
def check_deadlines():
    """Daily task: notify all active users about deadline and overdue reorder items."""
    from datetime import date, timedelta
    from decimal import Decimal
    from django.db.models import Sum, F
    from apps.inventory.models import InventoryItem, InventoryTransaction
    from apps.notifications.models import notify, Notification
    from apps.users.models import User

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    active_users = list(User.objects.filter(is_active=True))

    low_stock = InventoryItem.objects.filter(
        is_active=True,
        current_quantity__lte=F("min_stock_level"),
    ).select_related("vendor")

    for item in low_stock:
        consumption = item.transactions.filter(
            type=InventoryTransaction.Type.CONSUMPTION,
            created_at__date__gte=thirty_days_ago,
        ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")

        avg_daily = abs(consumption) / 30
        days_until_out = int(item.current_quantity / avg_daily) if avg_daily > 0 else 0
        order_by = today + timedelta(days=max(0, days_until_out - item.lead_time_days))
        vendor_name = item.vendor.name if item.vendor else "Unknown vendor"

        if order_by == today:
            for user in active_users:
                notify(
                    user=user,
                    type=Notification.Type.DEADLINE,
                    message=f"Order {item.name} from {vendor_name} today — {item.lead_time_days} day lead time",
                    link="/reorder",
                )
        elif order_by < today:
            days_late = (today - order_by).days
            for user in active_users:
                notify(
                    user=user,
                    type=Notification.Type.OVERDUE,
                    message=f"Overdue: {item.name} should have been ordered {days_late} day(s) ago",
                    link="/reorder",
                )
```

- [ ] **Step 2: Replace `backend/apps/inventory/signals.py`** with:
```python
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="inventory.InventoryTransaction")
def check_low_stock_on_transaction(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.type not in (
        instance.Type.CONSUMPTION,
        instance.Type.ADJUSTMENT,
    ):
        return

    item = instance.item
    if item.current_quantity > item.min_stock_level:
        return

    from apps.notifications.models import notify, Notification
    from apps.users.models import User

    vendor_name = item.vendor.name if item.vendor_id else "Unknown vendor"
    message = (
        f"{item.name} is low — {item.current_quantity} {item.unit_of_measure} remaining "
        f"(min: {item.min_stock_level}). Vendor: {vendor_name}"
    )
    for user in User.objects.filter(is_active=True):
        notify(user=user, type=Notification.Type.LOW_STOCK, message=message, link=f"/inventory/{item.id}")
```

- [ ] **Step 3: Add Celery Beat schedule to `backend/config/settings/base.py`**

Add after the existing Celery config:
```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "check-inventory-deadlines": {
        "task": "apps.inventory.tasks.check_deadlines",
        "schedule": crontab(hour=8, minute=0),
    },
}
```

- [ ] **Step 4: Verify Celery task is discoverable**
```bash
docker-compose exec celery celery -A config inspect registered 2>&1 | grep check_deadlines
```
Expected: `apps.inventory.tasks.check_deadlines`

- [ ] **Step 5: Run a smoke test on the signal — record a low-stock transaction**
```bash
docker-compose exec backend python manage.py shell -c "
from decimal import Decimal
from apps.users.models import User
from apps.inventory.services import record_transaction
from apps.inventory.models import InventoryItem, InventoryTransaction
from apps.notifications.models import Notification

user = User.objects.first()
item = InventoryItem.objects.create(
    name='Signal Test Item', unit_of_measure='units',
    current_quantity=Decimal('6'), min_stock_level=Decimal('5'),
    created_by=user, updated_by=user,
)
record_transaction(item=item, type=InventoryTransaction.Type.CONSUMPTION, quantity=Decimal('-2'), created_by=user)
count = Notification.objects.filter(type='low_stock').count()
print(f'Notifications created: {count}')
assert count > 0, 'Signal did not fire!'
print('Signal OK')
"
```
Expected: `Signal OK`

- [ ] **Step 6: Commit**
```bash
git add backend/apps/inventory/tasks.py backend/apps/inventory/signals.py backend/config/settings/base.py
git commit -m "feat: add low-stock signal and deadline Celery task"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**
```bash
docker-compose exec backend pytest tests/ -v 2>&1
```
Expected: all tests pass, 0 failures

- [ ] **Step 2: Run migrations clean**
```bash
docker-compose exec backend python manage.py migrate --check 2>&1
```
Expected: `No migrations to apply.`

- [ ] **Step 3: Check all API routes are registered**
```bash
docker-compose exec backend python manage.py show_urls 2>&1 | grep "api/v1"
```
Expected output includes:
```
/api/v1/vendors/
/api/v1/vendors/{id}/
/api/v1/vendors/{id}/items/
/api/v1/vendors/{id}/machines/
/api/v1/machines/
/api/v1/machines/{id}/items/
/api/v1/inventory/
/api/v1/inventory/{id}/transactions/
/api/v1/inventory/{id}/mark-ordered/
/api/v1/reorder/
/api/v1/notifications/
```

Note: `show_urls` requires `django-extensions`. Add it to `INSTALLED_APPS` in `dev.py` if not present:
```python
INSTALLED_APPS += ["django_extensions"]
```
Then `docker-compose exec backend pip install django-extensions`.

- [ ] **Step 4: Final commit**
```bash
git add .
git commit -m "feat: complete vendor/inventory/machine backend API with ledger and alerts"
```

---

## What's Next

**Plan 2 (Frontend)** covers:
- `Vendors.jsx` — searchable list with type filter badges
- `VendorDetail.jsx` — contact info, their items, their machines
- `Inventory.jsx` — catalog with low-stock highlights
- `InventoryDetail.jsx` — item detail + transaction history + record transaction form
- `ReorderQueue.jsx` — grouped by vendor, urgency colours, mark-ordered button
- `Machines.jsx` — asset list + machine detail with linked items tab
- Notification bell in NavBar (unread count badge, dropdown list)
