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
