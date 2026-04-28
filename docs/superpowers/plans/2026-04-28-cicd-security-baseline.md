# CI/CD Pipeline & Security Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the full GitHub Actions CI pipeline, security baseline, environment settings, and GitHub workflow infrastructure so all future Phase 1 feature work starts from a tested, OWASP-compliant foundation.

**Architecture:** All app-level security controls (JWT blacklist, rate limiting, CSP, audit logging) land in Django settings before any CI workflow files are written, so the first CI run validates a secure codebase. API versioning (`/api/v1/`) is applied before any tests are written so all tests use the correct paths from day one.

**Tech Stack:** Django 5 + DRF + SimpleJWT, pytest-django, GitHub Actions, whitenoise, django-csp, django-auditlog, bandit, pip-audit, ruff, pre-commit

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `omniFreight_Requirements_v1.md` | Modify | Correct carrier API phase + add OWASP compliance note |
| `backend/requirements.txt` | Modify | Add whitenoise, django-csp, django-auditlog, bandit, pip-audit, pre-commit |
| `backend/config/settings/test.py` | Create | Fast CI settings (MD5 passwords, no email, no throttling) |
| `backend/config/settings/staging.py` | Create | Railway staging (inherits prod.py, adds proxy SSL header) |
| `backend/pytest.ini` | Modify | Point to `config.settings.test` instead of `config.settings.dev` |
| `backend/config/urls.py` | Modify | All routes under `/api/v1/`, health at `/health/` |
| `frontend/src/lib/api.js` | Modify | `baseURL` → `/api/v1`, refresh URL → `/api/v1/auth/token/refresh/` |
| `backend/config/settings/base.py` | Modify | JWT blacklist, throttling, whitenoise, CSP, auditlog, logging, renderer |
| `backend/config/settings/prod.py` | Modify | whitenoise storage, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_REFERRER_POLICY` |
| `backend/apps/users/tests/__init__.py` | Create | Makes tests/ a package |
| `backend/apps/users/tests/test_security.py` | Create | JWT blacklist, rate limiting, versioning, security header tests |
| `.github/workflows/ci.yml` | Create | 7-job parallel CI pipeline |
| `.github/dependabot.yml` | Create | Weekly pip + npm dependency update PRs |
| `.github/pull_request_template.md` | Create | Enforces description, test plan, issue reference |
| `.github/ISSUE_TEMPLATE/feature.md` | Create | Feature request template |
| `.github/ISSUE_TEMPLATE/bug.md` | Create | Bug report template |
| `.github/ISSUE_TEMPLATE/config.yml` | Create | Disables blank issues |
| `.pre-commit-config.yaml` | Create | ruff, bandit, trailing-whitespace, end-of-file-fixer |
| `issues.md` | Modify | Full workflow conventions (was empty) |

---

## Task 1: Correct Requirements Document

**Files:**
- Modify: `omniFreight_Requirements_v1.md`

- [ ] **Step 1: Fix carrier API phase in Section 6.1**

In `omniFreight_Requirements_v1.md`, find Section 6.1 and replace the carrier tracking row:

```
| Carrier Tracking APIs (FedEx, UPS, DHL) | Auto-update shipment status from tracking number | REST API polling (Celery task) |
```

Remove it from the Phase 1 table entirely. Add a note below the table:

```
> **Note:** Carrier API polling moved to Phase 2. Phase 1 tracking number entry and status updates are manual only.
```

- [ ] **Step 2: Add OWASP compliance note to Section 5**

In Section 5 (Non-Functional Requirements), add a new row to the requirements table:

```
| Security Compliance | All API and infrastructure controls implemented in compliance with OWASP Top 10:2025 and OWASP API Security Top 10 (2023). See `docs/superpowers/specs/2026-04-27-cicd-workflow-design.md` for the full control matrix. |
```

- [ ] **Step 3: Commit**

```bash
git add omniFreight_Requirements_v1.md
git commit -m "docs: correct requirements — carrier API to phase 2, add OWASP 2025 compliance note"
```

---

## Task 2: Add Python Dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add new packages**

Replace the contents of `backend/requirements.txt` with:

```
# Django core
Django==5.1.*
djangorestframework==3.15.*
django-cors-headers==4.4.*

# Auth
djangorestframework-simplejwt==5.3.*

# Database
psycopg2-binary==2.9.*

# Task queue
celery==5.4.*
redis==5.1.*
django-celery-beat==2.7.*

# Environment / config
django-environ==0.11.*

# Storage
django-storages==1.14.*
boto3==1.35.*

# Images
Pillow==11.*

# Static files
whitenoise==6.*

# Security
django-csp==3.*
django-auditlog==3.*

# Production server
gunicorn==23.*

# Dev / testing
pytest==8.*
pytest-django==4.9.*
factory-boy==3.3.*

# Dev / security scanning
bandit==1.8.*
pip-audit==2.*
pre-commit==3.*

# Dev utilities
django-extensions==3.2.*
```

- [ ] **Step 2: Install locally to verify no conflicts**

```bash
docker-compose exec backend pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add whitenoise, django-csp, django-auditlog, bandit, pip-audit, pre-commit"
```

---

## Task 3: Create Test and Staging Settings Files

**Files:**
- Create: `backend/config/settings/test.py`
- Create: `backend/config/settings/staging.py`
- Modify: `backend/pytest.ini`

- [ ] **Step 1: Create `backend/config/settings/test.py`**

```python
from .base import *  # noqa: F401, F403

# Fast password hashing — never use in production
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Suppress outbound email in tests; captured in mail.outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Disable throttling globally — throttle tests use @override_settings
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {},
}
```

- [ ] **Step 2: Create `backend/config/settings/staging.py`**

```python
from .prod import *  # noqa: F401, F403

# Railway terminates SSL at the load balancer and forwards HTTP to the container.
# Django must trust the X-Forwarded-Proto header to identify requests as HTTPS.
# Without this, SECURE_SSL_REDIRECT causes an infinite redirect loop on Railway.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
```

- [ ] **Step 3: Update `backend/pytest.ini` to use test settings**

Replace the full content of `backend/pytest.ini`:

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.test
python_files = tests.py test_*.py *_tests.py
```

- [ ] **Step 4: Verify pytest still loads**

```bash
docker-compose exec backend pytest --collect-only
```

Expected: pytest collects tests (or reports "no tests ran") without import errors.

- [ ] **Step 5: Commit**

```bash
git add backend/config/settings/test.py backend/config/settings/staging.py backend/pytest.ini
git commit -m "chore: add test and staging settings files, point pytest at test settings"
```

---

## Task 4: Apply API Versioning

**Files:**
- Modify: `backend/config/urls.py`
- Modify: `frontend/src/lib/api.js`

All API paths move from `/api/` to `/api/v1/`. The health endpoint moves from `/api/health/` to `/health/` (Railway health check expects it there per the spec).

- [ ] **Step 1: Write the failing test**

Create `backend/apps/users/tests/__init__.py` (empty file).

Create `backend/apps/users/tests/test_security.py`:

```python
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()


class APIVersioningTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123!",
            role="staff",
        )

    def _get_tokens(self):
        response = self.client.post(
            "/api/v1/auth/token/",
            {"email": "test@example.com", "password": "testpass123!"},
            content_type="application/json",
        )
        return response.json()

    def test_versioned_token_endpoint_returns_200(self):
        response = self.client.post(
            "/api/v1/auth/token/",
            {"email": "test@example.com", "password": "testpass123!"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())

    def test_unversioned_token_endpoint_returns_404(self):
        response = self.client.post(
            "/api/auth/token/",
            {"email": "test@example.com", "password": "testpass123!"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_versioned_me_endpoint_returns_200(self):
        tokens = self._get_tokens()
        response = self.client.get(
            "/api/v1/users/me/",
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}",
        )
        self.assertEqual(response.status_code, 200)

    def test_health_endpoint_returns_ok(self):
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::APIVersioningTest -v
```

Expected: all 4 tests FAIL — `/api/v1/auth/token/` returns 404 (route not registered yet).

- [ ] **Step 3: Update `backend/config/urls.py`**

```python
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", include("apps.users.health_urls")),
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/users/", include("apps.users.urls")),
]
```

- [ ] **Step 4: Update `frontend/src/lib/api.js`**

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post("/api/v1/auth/token/refresh/", { refresh });
          localStorage.setItem("access_token", data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::APIVersioningTest -v
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/config/urls.py frontend/src/lib/api.js backend/apps/users/tests/
git commit -m "feat: version all API endpoints under /api/v1/, health at /health/"
```

---

## Task 5: JWT Token Blacklist (OWASP A07)

**Files:**
- Modify: `backend/config/settings/base.py`
- Modify: `backend/apps/users/tests/test_security.py`

- [ ] **Step 1: Write the failing test**

Add this class to `backend/apps/users/tests/test_security.py` below the existing `APIVersioningTest` class:

```python
class JWTBlacklistTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="blacklist@example.com",
            password="testpass123!",
            role="staff",
        )

    def test_rotated_refresh_token_is_rejected(self):
        # Obtain initial token pair
        response = self.client.post(
            "/api/v1/auth/token/",
            {"email": "blacklist@example.com", "password": "testpass123!"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        original_refresh = response.json()["refresh"]

        # Use the refresh token — this rotates it and should blacklist the original
        response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": original_refresh},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

        # Attempt to reuse the original (now blacklisted) refresh token
        response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": original_refresh},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::JWTBlacklistTest -v
```

Expected: FAIL — rotated refresh token is accepted (blacklist not active).

- [ ] **Step 3: Update `backend/config/settings/base.py`**

Add `rest_framework_simplejwt.token_blacklist` to `INSTALLED_APPS`:

```python
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "auditlog",
]
```

Change `BLACKLIST_AFTER_ROTATION` in `SIMPLE_JWT`:

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
```

- [ ] **Step 4: Run the migration**

```bash
docker-compose exec backend python manage.py migrate
```

Expected: applies `token_blacklist` migrations (creates `token_blacklist_blacklistedtoken` and `token_blacklist_outstandingtoken` tables).

- [ ] **Step 5: Run the test to confirm it passes**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::JWTBlacklistTest -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/config/settings/base.py
git commit -m "security: enable JWT refresh token blacklist (OWASP A07)"
```

---

## Task 6: Auth Rate Limiting (OWASP A07)

**Files:**
- Modify: `backend/config/settings/base.py`
- Modify: `backend/apps/users/tests/test_security.py`

- [ ] **Step 1: Write the failing test**

Add this class to `backend/apps/users/tests/test_security.py`:

```python
from django.test import override_settings
from rest_framework.test import APIClient


class AuthRateLimitTest(TestCase):
    @override_settings(
        REST_FRAMEWORK={
            **{
                "DEFAULT_AUTHENTICATION_CLASSES": (
                    "rest_framework_simplejwt.authentication.JWTAuthentication",
                ),
                "DEFAULT_PERMISSION_CLASSES": (
                    "rest_framework.permissions.IsAuthenticated",
                ),
                "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
                "PAGE_SIZE": 50,
                "EXCEPTION_HANDLER": "apps.users.exceptions.custom_exception_handler",
            },
            "DEFAULT_THROTTLE_CLASSES": [
                "rest_framework.throttling.AnonRateThrottle",
            ],
            "DEFAULT_THROTTLE_RATES": {"anon": "5/min"},
        }
    )
    def test_token_endpoint_rate_limited_after_threshold(self):
        client = APIClient()
        for _ in range(5):
            client.post(
                "/api/v1/auth/token/",
                {"email": "nobody@example.com", "password": "wrong"},
                format="json",
            )
        response = client.post(
            "/api/v1/auth/token/",
            {"email": "nobody@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::AuthRateLimitTest -v
```

Expected: FAIL — 6th request returns 401, not 429.

- [ ] **Step 3: Update `REST_FRAMEWORK` in `backend/config/settings/base.py`**

Add throttle settings to the existing `REST_FRAMEWORK` dict:

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "apps.users.exceptions.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/min",
        "user": "1000/day",
    },
    "DEFAULT_RENDERER_CLASSES": (
        ["rest_framework.renderers.JSONRenderer"]
        if not DEBUG
        else [
            "rest_framework.renderers.JSONRenderer",
            "rest_framework.renderers.BrowsableAPIRenderer",
        ]
    ),
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::AuthRateLimitTest -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/config/settings/base.py backend/apps/users/tests/test_security.py
git commit -m "security: add DRF throttling to auth endpoint, disable browsable API in prod (OWASP A07)"
```

---

## Task 7: Whitenoise + Production Security Headers

**Files:**
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/settings/prod.py`
- Modify: `backend/apps/users/tests/test_security.py`

- [ ] **Step 1: Write the failing test**

Add this class to `backend/apps/users/tests/test_security.py`:

```python
class SecurityHeadersTest(TestCase):
    def test_health_response_has_x_frame_options(self):
        response = self.client.get("/health/")
        self.assertEqual(response.get("X-Frame-Options"), "DENY")

    def test_health_response_has_content_type_nosniff(self):
        # X-Content-Type-Options is set by SecurityMiddleware when
        # SECURE_CONTENT_TYPE_NOSNIFF = True. In test settings it reads from base.
        response = self.client.get("/health/")
        self.assertEqual(response.get("X-Content-Type-Options"), "nosniff")
```

- [ ] **Step 2: Run to confirm `X-Content-Type-Options` test fails**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::SecurityHeadersTest -v
```

Expected: `test_health_response_has_x_frame_options` PASSES (already set by XFrameOptionsMiddleware). `test_health_response_has_content_type_nosniff` FAILS — header not present.

- [ ] **Step 3: Add `WhiteNoiseMiddleware` to `backend/config/settings/base.py`**

Update `MIDDLEWARE` — insert `whitenoise` immediately after `SecurityMiddleware`:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
```

Add `SECURE_CONTENT_TYPE_NOSNIFF` to `backend/config/settings/base.py` (applies to all environments):

```python
SECURE_CONTENT_TYPE_NOSNIFF = True
```

- [ ] **Step 4: Update `backend/config/settings/prod.py`**

Add to the end of `prod.py`:

```python
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
docker-compose exec backend pytest apps/users/tests/test_security.py::SecurityHeadersTest -v
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/config/settings/base.py backend/config/settings/prod.py \
        backend/apps/users/tests/test_security.py
git commit -m "security: add whitenoise for static files, security headers OWASP A02/A04"
```

---

## Task 8: CSP, Audit Logging, and Django Logging

**Files:**
- Modify: `backend/config/settings/base.py`

This task adds three controls that have no simple unit test (they're middleware-level concerns verified by the pen test checklist in the spec). The commit validates via Django system check.

- [ ] **Step 1: Update `INSTALLED_APPS` in `backend/config/settings/base.py`**

Update `THIRD_PARTY_APPS` to include `csp` and `auditlog`:

```python
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "csp",
    "auditlog",
]
```

- [ ] **Step 2: Add CSP middleware and auditlog middleware to `MIDDLEWARE`**

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
    "auditlog.middleware.AuditlogMiddleware",
]
```

- [ ] **Step 3: Add CSP settings to `backend/config/settings/base.py`**

```python
# Content Security Policy (OWASP A05 — XSS mitigation)
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")  # required for Tailwind CSS
CSP_IMG_SRC = ("'self'", "data:")
CSP_FONT_SRC = ("'self'",)
CSP_CONNECT_SRC = ("'self'",)
```

- [ ] **Step 4: Add Django LOGGING config to `backend/config/settings/base.py`**

```python
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
```

- [ ] **Step 5: Run the Django system check to verify no configuration errors**

```bash
docker-compose exec backend python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Run the full migration to create auditlog tables**

```bash
docker-compose exec backend python manage.py migrate
```

Expected: applies `auditlog` migrations.

- [ ] **Step 7: Run the full test suite to confirm nothing broke**

```bash
docker-compose exec backend pytest -v
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/config/settings/base.py
git commit -m "security: add CSP middleware, audit logging, Django request logging (OWASP A05/A06/A09)"
```

---

## Task 9: GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: omnifreight_test
          POSTGRES_USER: omnifreight
          POSTGRES_PASSWORD: omnifreight
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt
      - name: Install dependencies
        run: pip install -r backend/requirements.txt
      - name: Run tests
        run: pytest -v
        working-directory: backend
        env:
          DJANGO_SETTINGS_MODULE: config.settings.test
          DATABASE_URL: postgres://omnifreight:omnifreight@localhost:5432/omnifreight_test
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: ci-test-secret-key-not-for-production-use

  backend-lint:
    name: Backend Lint (ruff)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install ruff
      - run: ruff check backend/

  backend-sast:
    name: Backend SAST (bandit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install bandit
      - name: Run bandit SAST scan
        run: >
          bandit -r backend/
          --exclude backend/apps/users/tests,backend/apps/users/migrations
          -ll -ii

  backend-deps:
    name: Backend Dependency Audit (pip-audit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install pip-audit
      - run: pip-audit -r backend/requirements.txt

  migration-check:
    name: Migration Check
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: omnifreight_test
          POSTGRES_USER: omnifreight
          POSTGRES_PASSWORD: omnifreight
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt
      - run: pip install -r backend/requirements.txt
      - name: Check for missing migrations
        run: python manage.py makemigrations --check --dry-run
        working-directory: backend
        env:
          DJANGO_SETTINGS_MODULE: config.settings.test
          DATABASE_URL: postgres://omnifreight:omnifreight@localhost:5432/omnifreight_test
          SECRET_KEY: ci-test-secret-key-not-for-production-use

  frontend-build:
    name: Frontend Build (vite)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        run: npm ci
        working-directory: frontend
      - name: Build
        run: npm run build
        working-directory: frontend

  frontend-deps:
    name: Frontend Dependency Audit (npm audit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - name: Audit dependencies
        run: npm audit --audit-level=high
        working-directory: frontend
```

- [ ] **Step 2: Verify the YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add 7-job GitHub Actions CI pipeline with OWASP security scanning"
```

---

## Task 10: Dependabot Configuration

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: pip
    directory: /backend
    schedule:
      interval: weekly
      day: monday
    labels:
      - "type: chore"
    open-pull-requests-limit: 5

  - package-ecosystem: npm
    directory: /frontend
    schedule:
      interval: weekly
      day: monday
    labels:
      - "type: chore"
    open-pull-requests-limit: 5
```

- [ ] **Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: add Dependabot for weekly pip and npm dependency updates (OWASP A03)"
```

---

## Task 11: GitHub PR and Issue Templates

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `.github/ISSUE_TEMPLATE/feature.md`
- Create: `.github/ISSUE_TEMPLATE/bug.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create `.github/pull_request_template.md`**

```markdown
## What changed

<!-- Describe the change and the problem it solves. Reference the spec section if applicable. -->

## How to test

<!-- Steps to verify this works correctly -->

1.
2.

## Checklist

- [ ] Tests added or updated and passing
- [ ] No hardcoded secrets, credentials, or environment-specific values in code
- [ ] `Closes #` below is filled in

Closes #
```

- [ ] **Step 2: Create `.github/ISSUE_TEMPLATE/feature.md`**

```markdown
---
name: Feature
about: New feature or enhancement
labels: "type: feature"
---

## Problem this solves

<!-- Which core pain point does this address?
Pain Point 1: Single point of failure — knowledge locked in one person
Pain Point 2: Stock visibility — reactive reordering, unknown levels -->

## Proposed solution

## Module

- [ ] auth
- [ ] shipments
- [ ] inventory
- [ ] vendors
- [ ] payments
- [ ] sop
- [ ] dashboard

## Phase milestone

- [ ] 1A — Foundation
- [ ] 1B — Shipment Tracker
- [ ] 1C — Payments & Machines
- [ ] 1D — SOP & Dashboards
```

- [ ] **Step 3: Create `.github/ISSUE_TEMPLATE/bug.md`**

```markdown
---
name: Bug
about: Something is not working correctly
labels: "type: bug"
---

## Describe the bug

## Steps to reproduce

1.
2.
3.

## Expected behavior

## Actual behavior

## Environment

- [ ] Local Docker Compose
- [ ] Staging (Railway)
```

- [ ] **Step 4: Create `.github/ISSUE_TEMPLATE/config.yml`**

```yaml
blank_issues_enabled: false
contact_links: []
```

- [ ] **Step 5: Commit**

```bash
git add .github/pull_request_template.md .github/ISSUE_TEMPLATE/
git commit -m "chore: add PR template and issue templates for feature and bug reports"
```

---

## Task 12: Pre-commit Hooks

**Files:**
- Create: `.pre-commit-config.yaml`

- [ ] **Step 1: Create `.pre-commit-config.yaml`**

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]

  - repo: https://github.com/PyCQA/bandit
    rev: 1.8.0
    hooks:
      - id: bandit
        args: ["-ll", "-ii"]
        exclude: ^backend/apps/.*/migrations/|^backend/apps/.*/tests/

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-merge-conflict
```

- [ ] **Step 2: Install pre-commit hooks locally**

```bash
pip install pre-commit
pre-commit install
```

Expected: `pre-commit installed at .git/hooks/pre-commit`

- [ ] **Step 3: Run hooks against all files to confirm no failures**

```bash
pre-commit run --all-files
```

Expected: all hooks pass (or auto-fix trailing whitespace/EOF issues and pass on second run).

- [ ] **Step 4: Commit**

```bash
git add .pre-commit-config.yaml
git commit -m "chore: add pre-commit hooks for ruff, bandit SAST, and whitespace checks"
```

---

## Task 13: issues.md Workflow Conventions

**Files:**
- Modify: `issues.md`

- [ ] **Step 1: Replace `issues.md` with full conventions doc**

```markdown
# omniFreight — GitHub Workflow Conventions

## How We Work

1. **Issue first.** Open a GitHub Issue before writing any code.
2. **Branch from main.** Create a branch named after the issue number.
3. **PR to merge.** All work merges via Pull Request — no direct commits to `main`.
4. **Review and approve.** Claude opens PRs as draft, marks ready when done; you approve and merge.
5. **CI must pass.** All 7 CI checks must be green before merge is allowed.

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<issue-number>-<short-description>` | `feature/12-shipment-tracker` |
| Bug fix | `fix/<issue-number>-<short-description>` | `fix/23-auth-token-refresh` |
| Chore | `chore/<description>` | `chore/update-dependencies` |

## Labels

### Module
| Label | Used for |
|---|---|
| `module: auth` | Authentication and user management |
| `module: shipments` | Shipment tracker module |
| `module: inventory` | Inventory and supply management |
| `module: vendors` | Vendor management |
| `module: payments` | Payment tracker |
| `module: sop` | SOP library |
| `module: dashboard` | Dashboard and widgets |

### Type
| Label | Used for |
|---|---|
| `type: feature` | New feature or enhancement |
| `type: bug` | Something broken |
| `type: chore` | Dependency updates, config, maintenance |

### Priority
| Label | Used for |
|---|---|
| `priority: high` | Blocking other work or affecting daily use |
| `priority: medium` | Important but not blocking |
| `priority: low` | Nice to have |

## Milestones

| Milestone | Scope |
|---|---|
| Phase 1A — Foundation | Auth, user roles, vendor management, basic inventory catalog |
| Phase 1B — Shipment Tracker | Shipment module, status pipeline, deadline alerts, document attachments |
| Phase 1C — Payments & Machines | Payment tracker, machine asset registry, critical spares, ink tracking |
| Phase 1D — SOP & Dashboards | SOP module, customizable dashboards, predictive reorder engine |

## PR Checklist

Every PR must:
- Reference `Closes #<issue-number>` in the description
- Have a clear description of what changed and why
- Include a test plan
- Pass all 7 CI checks
- Be reviewed and approved before merge

## CI Checks (all must pass)

| Check | What it verifies |
|---|---|
| `backend-tests` | pytest suite passes against Postgres + Redis |
| `backend-lint` | Python code quality (ruff) |
| `backend-sast` | No injection or unsafe patterns (bandit, OWASP A05) |
| `backend-deps` | No known CVEs in Python dependencies (pip-audit, OWASP A03) |
| `migration-check` | No missing Django migrations |
| `frontend-build` | Vite build succeeds |
| `frontend-deps` | No high/critical CVEs in Node dependencies (npm audit, OWASP A03) |

## Security Compliance

All controls comply with OWASP Top 10:2025 and OWASP API Security Top 10 (2023).
Full control matrix: `docs/superpowers/specs/2026-04-27-cicd-workflow-design.md`

Before marking any Phase 1 milestone complete, run the pen test checklist in
Section 10.4 of the design spec.

## Manual GitHub Setup (one-time, owner only)

See `docs/superpowers/specs/2026-04-27-cicd-workflow-design.md` Section 12 for
step-by-step instructions covering:
- GitHub secret scanning and push protection
- Branch protection rules on `main`
- Milestones and label creation
- Railway project connection and environment variables
```

- [ ] **Step 2: Commit**

```bash
git add issues.md
git commit -m "docs: populate issues.md with GitHub workflow conventions and CI reference"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Covered by Task |
|---|---|
| 2. Requirements corrections (carrier API, OWASP note) | Task 1 |
| 3.3 PR template | Task 11 |
| 3.4 GitHub templates (PR + 2 issue templates) | Task 11 |
| 3.5 Dependabot (pip weekly, npm weekly) | Task 10 |
| 4.1 CI: backend-tests | Task 9 |
| 4.1 CI: backend-lint (ruff) | Task 9 |
| 4.1 CI: backend-sast (bandit) | Task 9 |
| 4.1 CI: backend-deps (pip-audit) | Task 9 |
| 4.1 CI: migration-check | Task 9 |
| 4.1 CI: frontend-build | Task 9 |
| 4.1 CI: frontend-deps (npm audit) | Task 9 |
| 4.2 Pre-commit hooks (ruff, bandit, whitespace) | Task 12 |
| 6.1 JWT blacklist (BLACKLIST_AFTER_ROTATION=True, token_blacklist app) | Task 5 |
| 6.2 Auth rate limiting (20/min anon throttle) | Task 6 |
| 6.3 API versioning (/api/v1/) | Task 4 |
| 6.4 Whitenoise for static files | Task 7 |
| 7. issues.md conventions | Task 13 |
| 8.1 test.py settings | Task 3 |
| 8.1 staging.py settings | Task 3 |
| 8.2 pytest.ini updated to test settings | Task 3 |
| 10.3 CSP middleware + settings | Task 8 |
| 10.3 Audit logging (django-auditlog) | Task 8 |
| 10.3 Security logging (Django LOGGING config) | Task 8 |
| 10.3 SECURE_CONTENT_TYPE_NOSNIFF | Task 7 |
| 10.3 SECURE_REFERRER_POLICY | Task 7 |
| 11. requirements.txt additions | Task 2 |
| 11. staging.py new file | Task 3 |
| 11. test.py new file | Task 3 |

All spec checklist items are covered. No gaps found.

### Placeholder Scan

No TBD, TODO, or "implement later" markers present. All code blocks are complete.

### Type Consistency

- `User.objects.create_user` used in tests matches the custom User model in `apps/users/models.py` which extends `AbstractUser`.
- `role` field used in test setUp matches the existing `User` model field.
- `/api/v1/auth/token/` URL used in tests matches the URL registered in Task 4's `urls.py`.
- `REST_FRAMEWORK` dict merged in `test.py` with `**REST_FRAMEWORK` is valid because `from .base import *` makes `REST_FRAMEWORK` available in the local scope before the merge expression is evaluated.
- `AuditlogMiddleware` is added after `AuthenticationMiddleware` — correct, as auditlog reads `request.user` lazily at save-time, not at middleware chain time.
