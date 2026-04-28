# omniFreight — CI/CD & GitHub Workflow Design

| Field | Value |
|---|---|
| Date | 2026-04-27 |
| Status | Approved |
| Scope | CI/CD pipeline, GitHub workflow, security hardening, environment strategy, API conventions, vendor decoupling |

---

## 1. Overview

This document specifies the GitHub workflow, CI/CD pipeline, environment strategy, security baseline, and vendor-decoupling architecture for omniFreight Phase 1. All decisions are scoped to the GitHub Flow model using Railway for staging, with a clean migration path to Hetzner VPS for production.

Security controls in this design are implemented in compliance with the **OWASP Top 10:2025**, the **OWASP API Security Top 10 (2023)** (no 2025 edition published as of April 2026), and the Non-Functional Requirements defined in `omniFreight_Requirements_v1.md` Section 5, specifically:
- Role-based access enforced on all API endpoints
- No unauthenticated access to any data
- All creates, edits, and deletes logged with user and timestamp
- Architecture must support growth without redesign

The design is built to pass a penetration test at any point during Phase 1 — not just at launch. Controls are applied from the first line of feature code.

---

## 2. Requirements Document Corrections

The following corrections apply to `omniFreight_Requirements_v1.md` and must be reflected when the document is next revised:

| Section | Current | Corrected |
|---|---|---|
| 6.1 Phase 1 Integrations | Carrier Tracking APIs (FedEx, UPS, DHL) listed as Phase 1 | Move to Phase 2. Phase 1 tracking is manual entry only. |
| 5. Non-Functional Requirements | No mention of OWASP compliance | Add: "All API and infrastructure controls are implemented in compliance with OWASP Top 10:2025 and OWASP API Security Top 10 (2023). See CI/CD workflow design for specific controls." |

---

## 3. GitHub Workflow

### 3.1 Branching Strategy — GitHub Flow

`main` is always deployable. Every unit of work lives in a short-lived branch that merges back via Pull Request.

**Branch naming:**
```
feature/<issue-number>-<short-description>   →  feature/12-shipment-tracker
fix/<issue-number>-<short-description>        →  fix/23-auth-token-refresh
chore/<description>                           →  chore/update-dependencies
```

**Rules:**
- No direct commits to `main`
- Branch protection on `main`: require PR, require all CI checks to pass, require at least 1 approval
- Branches are deleted after merge

### 3.2 GitHub Issues

Every piece of work starts as a GitHub Issue before any code is written.

**Milestones** (aligned to `omniFreight_Requirements_v1.md` Section 9):

| Milestone | Scope |
|---|---|
| Phase 1A — Foundation | Auth, user roles, vendor management, basic inventory catalog |
| Phase 1B — Shipment Tracker | Shipment module, status pipeline, deadline alerts, document attachments |
| Phase 1C — Payments & Machines | Payment tracker, machine asset registry, critical spares, ink tracking |
| Phase 1D — SOP & Dashboards | SOP module, customizable dashboards, predictive reorder engine |

**Labels:**

| Group | Labels |
|---|---|
| Module | `module: auth`, `module: shipments`, `module: inventory`, `module: vendors`, `module: payments`, `module: sop`, `module: dashboard` |
| Type | `type: feature`, `type: bug`, `type: chore` |
| Priority | `priority: high`, `priority: medium`, `priority: low` |

### 3.3 Pull Requests

- Every branch merges via PR — no exceptions
- PR description must include `Closes #<issue-number>` to auto-close the linked issue on merge
- PR template enforces: description, test plan, issue reference
- User reviews and approves before any merge
- CI must fully pass before merge is permitted

### 3.4 GitHub Templates

The following templates live in `.github/`:

- `.github/pull_request_template.md` — enforces description, test plan, `Closes #N`
- `.github/ISSUE_TEMPLATE/feature.md` — feature request template
- `.github/ISSUE_TEMPLATE/bug.md` — bug report template

### 3.5 Dependabot

`.github/dependabot.yml` configures automated dependency update PRs:
- Python (`/backend`) — weekly
- npm (`/frontend`) — weekly

This provides ongoing compliance with **OWASP A06:2021 – Vulnerable and Outdated Components**.

---

## 4. CI Pipeline — GitHub Actions

File: `.github/workflows/ci.yml`
Trigger: `pull_request` targeting `main`

All jobs run in parallel. All must pass before merge is permitted.

### 4.1 Jobs

| Job | Tool | Purpose | OWASP Control |
|---|---|---|---|
| `backend-tests` | pytest + pytest-django | Run full test suite against Postgres + Redis services | Correctness |
| `backend-lint` | ruff | Python style and code quality | Code quality |
| `backend-sast` | bandit | Static analysis for injection patterns, hardcoded secrets, unsafe calls | A03, A05 |
| `backend-deps` | pip-audit | Scan Python dependencies for known CVEs | A06 |
| `migration-check` | manage.py makemigrations --check | Fail if model changes are missing a migration | Deploy correctness |
| `frontend-build` | vite build | Catch broken imports, JSX errors, missing assets | Correctness |
| `frontend-deps` | npm audit | Scan Node dependencies for known CVEs | A06 |

### 4.2 Pre-commit Hooks

File: `.pre-commit-config.yaml`

Hooks run locally before each commit, catching issues before they reach CI:
- `ruff` — Python linting
- `bandit` — Python SAST
- `trailing-whitespace` — whitespace cleanup
- `end-of-file-fixer` — consistent line endings

Developers install via `pre-commit install` after cloning.

---

## 5. CD Pipeline — Railway (Development)

### 5.1 Deployment Method

Railway's native GitHub integration handles deployment — no GitHub Actions involvement. This preserves GitHub Actions free-tier minutes for CI only.

- Railway connects directly to `github.com/jpue314/omniFreight`
- On merge to `main`, Railway detects the push and rebuilds automatically
- Services: one Railway service for Django backend, one for Vite frontend (static build)
- Environment variables live in Railway's dashboard — never in the repository

### 5.2 Start Command (Critical)

The Railway backend start command must run migrations before starting the server:

```bash
python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

This ensures the database schema is always current before the application accepts requests. Without this, a deploy containing model changes would start serving against an unmigrated database.

### 5.3 Health Check

Railway uses the existing `/health/` endpoint (defined in `apps/users/health_urls.py`) to verify successful deployment. Configure in Railway dashboard: `GET /health/` expecting `{"status": "ok"}`.

### 5.4 Future: Hetzner VPS Production

When migrating to Hetzner VPS, a second workflow file (`.github/workflows/deploy-prod.yml`) will be added. It triggers on a `v*` release tag and SSH-deploys to the VPS. This is out of scope for Phase 1 and should not be implemented until the Railway deployment is in daily use.

---

## 6. Application Security Baseline

These are application-level changes required as part of Phase 1A Foundation work. They are documented here because they were identified during CI/CD design review and must be in place before any feature work begins.

### 6.1 JWT Token Blacklist — OWASP A07

**Current state:** `BLACKLIST_AFTER_ROTATION = False` in `base.py`. Rotated refresh tokens are not invalidated, allowing indefinite reuse of stolen tokens.

**Required change:**
- Set `BLACKLIST_AFTER_ROTATION = True` in `base.py`
- Add `rest_framework_simplejwt.token_blacklist` to `INSTALLED_APPS`
- Run `manage.py migrate` to create blacklist tables

**Compliance:** OWASP A07:2021 – Identification and Authentication Failures

### 6.2 Auth Endpoint Rate Limiting — OWASP A07

**Current state:** `/api/v1/auth/token/` has no rate limit. Credential brute-force is unrestricted.

**Required change:** Apply DRF throttling to the token endpoint:
```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "20/min"},
}
```

**Compliance:** OWASP A07:2021 – Identification and Authentication Failures

### 6.3 API Versioning — Technical Debt Prevention

**Current state:** Endpoints registered under `/api/` with no version prefix.

**Required change:** All endpoints registered under `/api/v1/` from the first line of feature code. This is the single highest-leverage technical debt decision — adding versioning after endpoints are in daily use requires touching every URL in the backend and every API call in the frontend simultaneously.

**Convention:** `http://localhost:8000/api/v1/` in development, same prefix in production.

### 6.4 Static File Serving — Production Correctness

**Current state:** `whitenoise` is not in `requirements.txt`. Railway deploys will fail to serve static assets (Django admin, uploaded files metadata, etc.) without a static file serving solution.

**Required change:**
- Add `whitenoise` to `requirements.txt`
- Add `WhiteNoiseMiddleware` to `MIDDLEWARE` in `base.py` (after `SecurityMiddleware`)
- Set `STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"` in `prod.py`

---

## 7. issues.md Conventions

`issues.md` in the repository root documents the working conventions for this project:

- Label taxonomy and definitions
- Branch naming pattern with examples
- PR checklist requirements
- Milestone definitions
- Workflow: issue opened → branch created → PR opened (draft) → PR marked ready → user approves → merge → issue auto-closes

This document replaces tribal knowledge about how work is tracked and reviewed — directly addressing Pain Point 1 from the project requirements (single point of failure, critical knowledge locked in one person).

---

## 8. Environment Strategy

### 8.1 Four Environments, Two Deployed Now

| Environment | Settings file | Runs on | Deployed now? | Purpose |
|---|---|---|---|---|
| `local` | `config.settings.dev` | Docker Compose | Yes — always | Active development and manual testing |
| `test` (CI) | `config.settings.test` | GitHub Actions (ephemeral) | Yes — every PR | Automated test suite, migration checks, security scans |
| `staging` | `config.settings.staging` | Railway | Yes — free tier | Integration testing, PR review, pre-merge validation |
| `production` | `config.settings.prod` | Hetzner VPS | **Deferred until go-live** | Real users, real data |

Railway is **staging**, not production. This distinction matters: staging uses production-like security settings (HTTPS, HSTS, secure cookies) but development data. It is the environment where work is reviewed before it is considered done — not where real users operate.

### 8.2 Settings Inheritance

```
base.py          <- shared config for all environments
├── dev.py       <- local Docker Compose (DEBUG=True, relaxed CORS)
├── test.py      <- CI (fast Postgres, no email, fast password hashing)
├── staging.py   <- Railway (inherits prod.py security, Railway env vars)
└── prod.py      <- Hetzner VPS (full production config, S3, SendGrid)
```

`staging.py` inherits from `prod.py` directly:

```python
from .prod import *  # all security settings apply in staging too
```

This means staging catches production-specific bugs (SSL redirects, missing env vars, HSTS issues) before they reach real users.

### 8.3 Environment Variables Per Environment

| Variable | local | test/CI | staging | production |
|---|---|---|---|---|
| `DEBUG` | `True` | `False` | `False` | `False` |
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` | `config.settings.test` | `config.settings.staging` | `config.settings.prod` |
| `DATABASE_URL` | Docker Compose Postgres | GitHub Actions Postgres service | Railway Postgres plugin | Hetzner managed Postgres |
| `SECRET_KEY` | `.env` (local only, never committed) | GitHub Actions secret | Railway Variables | Hetzner server env |
| `ALLOWED_HOSTS` | `*` | `testserver` | `<app>.railway.app` | `yourdomain.com` |

No environment variable values are ever committed to the repository.

---

## 9. Vendor Decoupling Architecture

The goal is that switching from Railway to Hetzner, or from SendGrid to another email provider, or from AWS S3 to Hetzner Object Storage, requires **only environment variable changes** — never application code changes.

### 9.1 What Is Decoupled and How

| Concern | Decoupling mechanism | Switch cost |
|---|---|---|
| **Database** | `DATABASE_URL` env var parsed by `django-environ` — any Postgres URL works | Change one env var |
| **File storage** | `django-storages` + `DEFAULT_FILE_STORAGE` setting — S3-compatible API works for AWS S3, Hetzner Object Storage, MinIO | Change 4 env vars |
| **Email** | Django's `EMAIL_BACKEND` setting — swap SendGrid for any SMTP provider | Change 2–3 env vars |
| **Task queue** | `CELERY_BROKER_URL` env var — any Redis-compatible broker | Change one env var |
| **Deployment** | Docker Compose defines the full stack — same containers run on Railway or any VPS with Docker | No code change |
| **Static files** | `whitenoise` serves static files from Django — no Nginx dependency for static assets | No change needed |
| **Frontend** | Vite produces a static build — deployable to any static host, CDN, or served by Django/Nginx | No code change |

### 9.2 What Must Never Be Hardcoded

The following must never appear in application code — only in environment variables or settings files:
- Hostnames, domains, or IP addresses
- Database connection strings
- S3 bucket names or regions
- API keys of any kind
- Service-specific initialization that is not behind a settings abstraction

### 9.3 Hetzner Object Storage Compatibility

Hetzner Object Storage is S3-compatible. The switch from AWS S3 to Hetzner Object Storage requires only two additional settings in `staging.py` or `prod.py`:

```python
AWS_S3_ENDPOINT_URL = "https://<region>.your-objectstorage.com"
AWS_S3_REGION_NAME  = "eu-central-1"
```

No other application code changes. `django-storages` handles both backends transparently.

---

## 10. Penetration Test Readiness and Forward Cybersecurity

This section documents controls applied so omniFreight can pass a penetration test at any point during Phase 1 — not just at launch. Controls are applied from the first line of feature code.

### 10.1 OWASP Top 10:2025

The 2025 edition introduced two new categories and reordered several risks from the 2021 edition:
- **New:** A03 — Software Supply Chain Failures (broader than the old "Vulnerable Components")
- **New:** A10 — Mishandling of Exceptional Conditions (replaces SSRF, which dropped out of the Top 10)
- **Moved up:** Security Misconfiguration from #5 to #2

| OWASP 2025 ID | Risk | Control in omniFreight |
|---|---|---|
| A01 — Broken Access Control | User A reads User B's data | Object-level permission checks on every ViewSet. `IsAuthenticated` global default. Role checks via `IsAdmin`/`IsStaff` permission classes. Tests verify cross-user data isolation on every endpoint. |
| A02 — Security Misconfiguration | DEBUG in prod, open CORS, verbose errors, exposed admin | `DEBUG=False` globally by default. CORS explicitly whitelisted per environment. `ALLOWED_HOSTS` locked. DRF browsable API disabled in staging + prod. `bandit` SAST in CI. |
| A03 — Software Supply Chain Failures *(new in 2025)* | Compromised or tampered dependencies and build pipeline | `pip-audit` + `npm audit` on every PR. Dependabot weekly update PRs. GitHub secret scanning on all commits. CI runs in GitHub-hosted runners — no self-hosted runner supply chain risk. |
| A04 — Cryptographic Failures | Plaintext secrets, weak tokens, unencrypted data in transit | `SECRET_KEY` via env var only — never in code. JWT blacklist on rotation. HTTPS enforced in staging + prod. HSTS with preload. `SECURE_CONTENT_TYPE_NOSNIFF = True`. |
| A05 — Injection | SQL injection, command injection, template injection | Django ORM exclusively — no raw SQL in application code. `bandit` SAST flags unsafe subprocess calls and concatenated query patterns on every PR. |
| A06 — Insecure Design | Architectural flaws baked into the system | API-first, role-based design from day one. Audit log on all writes. UUID primary keys prevent ID enumeration. Payment records immutable once Confirmed. Pen test checklist run before each milestone. |
| A07 — Authentication Failures | Brute force, token theft, missing expiry | DRF throttling on `/api/v1/auth/token/` (20 req/min anon). JWT blacklist on rotation. 60-min access token, 7-day refresh token. |
| A08 — Software or Data Integrity Failures | Tampered packages, CI/CD pipeline compromise, unsafe deserialization | `pip-audit` + `npm audit` check advisory databases on every PR. No unsafe deserialization patterns in code — `bandit` flags these. CI pipeline runs in isolated GitHub-hosted runners. |
| A09 — Security Logging and Alerting Failures | No detection of attacks, no alerting on anomalies | Django `logging` config captures all 4xx/5xx with user + IP + timestamp. Auth events and payment status changes logged at `WARNING`. Active in all environments including staging. |
| A10 — Mishandling of Exceptional Conditions *(new in 2025)* | Stack traces in prod, unhandled errors leaking internal state | `DEBUG=False` suppresses stack traces in staging + prod. Custom DRF exception handler returns only clean `{errors}` envelope. All unhandled 500s logged with full context for debugging without exposure. Verified in pen test checklist. |

### 10.2 OWASP API Security Top 10 (2023)

Because omniFreight is API-first, the API Top 10 is equally important.

| OWASP API ID | Risk | Control in omniFreight |
|---|---|---|
| API1 — Broken Object Level Auth | User A reads User B's shipment by guessing UUID | Every queryset filtered to `request.user` scope. Tests verify cross-user data isolation on every endpoint. |
| API2 — Broken Authentication | Token brute force, missing expiry | Rate limiting on token endpoint. JWT expiry enforced. Blacklist on rotation. |
| API3 — Broken Object Property Exposure | Serializer leaks internal fields | All serializers use explicit `fields` lists — never `fields = '__all__'`. |
| API4 — Unrestricted Resource Consumption | Unbounded list responses, large file uploads | DRF pagination global (`PAGE_SIZE=50`). File upload size limit enforced at Django level. |
| API5 — Broken Function Level Auth | Staff calling admin-only endpoints | Every admin action gated by `IsAdmin` permission class. CI tests verify Staff receives 403 on admin endpoints. |
| API6 — Unrestricted Sensitive Business Flows | Payment status changed without audit trail | Payment status transitions validated. Every change audit-logged with user + timestamp. |
| API7 — Server-Side Request Forgery | URL fields used in server-side HTTP calls | `reorder_url` and `website` fields are stored strings only — never fetched server-side in Phase 1. |
| API8 — Security Misconfiguration | Verbose error responses, open CORS | `DEBUG=False` in staging + prod suppresses stack traces. Custom exception handler returns clean `{errors}` envelope only. |
| API9 — Improper Inventory Management | Undocumented or shadow API endpoints | All endpoints under `/api/v1/`. No unversioned routes. DRF browsable API disabled in staging + prod. |
| API10 — Unsafe API Consumption | Trusting external API responses without validation | Phase 2 carrier API responses validated and sanitized before writing to DB. Schema validated with DRF serializers. |

### 10.3 Additional Security Controls

**Content Security Policy (CSP):**
`django-csp` added to middleware. Restricts which sources the browser trusts for scripts and styles — limits XSS payload execution even if an injection vulnerability is found.

```python
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC  = ("'self'",)
CSP_STYLE_SRC   = ("'self'", "'unsafe-inline'")  # required for Tailwind
```

**File Upload Security (Phase 1B — document attachments):**
- Server-side MIME type validation (not extension check only)
- Maximum file size enforced (10 MB default)
- Files stored in S3/Hetzner Object Storage, accessed via presigned URLs — never served through Django
- Filenames sanitized before storage to prevent path traversal

**Audit Logging:**
`django-auditlog` installed to log all model changes with user, timestamp, changed fields, and previous values. Directly satisfies the requirements doc non-functional requirement: *"All creates, edits, and deletes are logged with user and timestamp. Payment records are immutable once Confirmed."*

**Security Headers (full set applied in staging + prod):**

| Header | Mechanism |
|---|---|
| `Strict-Transport-Security` | `SECURE_HSTS_SECONDS` in `prod.py` (already set) |
| `X-Frame-Options: DENY` | `XFrameOptionsMiddleware` (already in place) |
| `X-Content-Type-Options: nosniff` | `SECURE_CONTENT_TYPE_NOSNIFF = True` added to `prod.py` |
| `Content-Security-Policy` | `django-csp` middleware |
| `Referrer-Policy` | `SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"` added to `prod.py` |

**Secrets Never in Code:**
Enforced by three independent layers: `.gitignore` excludes `.env`, GitHub secret scanning blocks commits containing secret patterns, `bandit` SAST flags hardcoded credential-shaped strings.

### 10.4 Pre-Milestone Penetration Test Checklist

Before marking any Phase 1 milestone complete, run the following manual checks:

- [ ] Access another user's record by substituting a known UUID in the URL — expect 403 or 404
- [ ] Send 25 rapid login attempts to `/api/v1/auth/token/` — expect 429 (too many requests) after 20
- [ ] Send a request with a malformed or expired Bearer token — expect 401
- [ ] As a Staff user, attempt to change another user's role — expect 403
- [ ] Upload a file with a script-language extension and matching header bytes — expect 400
- [ ] Confirm all error responses in staging contain no stack traces or internal paths
- [ ] Trigger a deliberate 404 in staging — confirm no debug page is served
- [ ] Run `pip-audit` and `npm audit` locally — expect zero high or critical findings
- [ ] Check response headers in staging with browser DevTools — confirm CSP, HSTS, X-Frame-Options are present

---

## 11. Summary Checklist

### Files to create (Claude handles these)
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/feature.md`
- `.github/ISSUE_TEMPLATE/bug.md`
- `.pre-commit-config.yaml`
- `issues.md` (populated with conventions)

### Files to modify (Claude handles these)
- `backend/requirements.txt` — add `whitenoise`, `bandit`, `pip-audit`, `pre-commit`, `django-csp`, `django-auditlog`
- `backend/config/settings/base.py` — JWT blacklist, DRF throttling, whitenoise middleware, `/api/v1/` URLs, CSP, audit log
- `backend/config/settings/prod.py` — whitenoise storage, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_REFERRER_POLICY`
- `backend/config/settings/staging.py` — new file, inherits from `prod.py`
- `backend/config/settings/test.py` — new file, fast CI config
- `omniFreight_Requirements_v1.md` — carrier API correction, OWASP compliance note

### Manual setup steps (you must do these — no one else can)
See Section 12 for full step-by-step instructions.

---

## 12. Manual Setup Guide

These steps require your credentials or account access and cannot be automated. Each step notes what it enables and why it cannot be skipped.

---

### Step 1 — GitHub: Enable Secret Scanning

**What it does:** GitHub automatically scans every commit for accidentally committed secrets (API keys, passwords, tokens). If found, it alerts you immediately and can block the push.

1. Go to `https://github.com/jpue314/omniFreight`
2. Click **Settings** (top tab bar)
3. In the left sidebar, click **Security** → **Code security and analysis**
4. Next to **Secret scanning**, click **Enable**
5. Next to **Push protection**, click **Enable** — this blocks a push that contains a detected secret before it lands in git history

> Why you must do this: GitHub requires account owner permissions to enable security features. No code change can substitute for this.

---

### Step 2 — GitHub: Set Branch Protection on `main`

**What it does:** Prevents direct pushes to `main`, requires CI to pass, and requires your review before any PR can merge.

1. Go to `https://github.com/jpue314/omniFreight`
2. Click **Settings** → **Branches**
3. Click **Add branch protection rule**
4. In **Branch name pattern**, type: `main`
5. Check the following boxes:
   - ✅ **Require a pull request before merging**
     - Set **Required approvals** to `1`
   - ✅ **Require status checks to pass before merging**
     - After CI runs once, search for and add: `backend-tests`, `backend-lint`, `backend-sast`, `backend-deps`, `migration-check`, `frontend-build`, `frontend-deps`
     - ✅ Check **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings**
6. Click **Create**

> Note: The status check names won't appear in the search box until the CI workflow has run at least once. Complete the rest of setup first, open a test PR, then come back and add them.

---

### Step 3 — GitHub: Create Milestones

**What it does:** Groups issues by delivery phase so you can see progress toward each milestone at a glance.

1. Go to `https://github.com/jpue314/omniFreight/milestones`
2. Click **New milestone** and create each of the following:

| Title | Description | Due date |
|---|---|---|
| Phase 1A — Foundation | Auth, user roles, vendor management, basic inventory catalog | (leave blank) |
| Phase 1B — Shipment Tracker | Shipment module, status pipeline, deadline alerts, document attachments | (leave blank) |
| Phase 1C — Payments & Machines | Payment tracker, machine asset registry, critical spares, ink tracking | (leave blank) |
| Phase 1D — SOP & Dashboards | SOP module, customizable dashboards, predictive reorder engine | (leave blank) |

---

### Step 4 — GitHub: Create Labels

**What it does:** Labels let you filter issues by module, type, and priority across the whole project.

1. Go to `https://github.com/jpue314/omniFreight/labels`
2. Delete the default GitHub labels (optional but keeps things clean)
3. Create the following labels:

**Module labels** (suggested color: blue `#0075ca`):

| Label | Description |
|---|---|
| `module: auth` | Authentication and user management |
| `module: shipments` | Shipment tracker module |
| `module: inventory` | Inventory and supply management |
| `module: vendors` | Vendor management |
| `module: payments` | Payment tracker |
| `module: sop` | SOP library |
| `module: dashboard` | Dashboard and widgets |

**Type labels** (suggested color: purple `#d93f0b` for bug, green `#0e8a16` for feature, gray `#e4e669` for chore):

| Label | Color |
|---|---|
| `type: feature` | `#0e8a16` |
| `type: bug` | `#d93f0b` |
| `type: chore` | `#e4e669` |

**Priority labels** (suggested color: red → yellow → gray):

| Label | Color |
|---|---|
| `priority: high` | `#b60205` |
| `priority: medium` | `#fbca04` |
| `priority: low` | `#cccccc` |

---

### Step 5 — Railway: Create Account and Connect Repository

**What it does:** Sets up the Railway project that auto-deploys when code merges to `main`.

1. Go to `https://railway.app` and sign up / log in with your GitHub account
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `jpue314/omniFreight`
4. Railway will detect the `docker-compose.yml` and scaffold services — you may need to configure them individually (backend, frontend, Postgres, Redis)
5. For the **backend service**, set the start command (see Step 6)
6. For **Postgres**, Railway can provision a managed database — click **Add Plugin** → **PostgreSQL**
7. For **Redis**, click **Add Plugin** → **Redis**

> Railway's free tier ("Hobby") gives $5/month of free usage. A Django + React + Postgres + Redis setup at low traffic stays well within this.

---

### Step 6 — Railway: Set Environment Variables

**What it does:** Provides all secrets and config to the running app without storing them in the repository.

In your Railway backend service, go to **Variables** and add each of the following:

| Variable | Value | Notes |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` | Use `config.settings.prod` when ready for production |
| `SECRET_KEY` | *(generate a random 50-char string)* | Never reuse between environments. Generate with: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DEBUG` | `False` | Always False on Railway, even for dev purposes |
| `DATABASE_URL` | *(auto-set by Railway Postgres plugin)* | Railway sets this automatically when you attach the Postgres plugin |
| `REDIS_URL` | *(auto-set by Railway Redis plugin)* | Railway sets this automatically when you attach the Redis plugin |
| `ALLOWED_HOSTS` | `your-app-name.railway.app` | Replace with your actual Railway domain |
| `CORS_ALLOWED_ORIGINS` | `https://your-frontend.railway.app` | Replace with your actual frontend Railway domain |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Switch to SendGrid when email alerts are needed in Phase 1B |

> **Do not put any of these values in `.env`, `settings.py`, or anywhere in the repository.** Railway's Variables tab is the only place they should live.

---

### Step 7 — Railway: Set Start Command and Health Check

**What it does:** Ensures migrations run automatically on every deploy and Railway knows how to verify the app started correctly.

1. In your Railway backend service, click **Settings**
2. Under **Deploy**, set **Start Command** to:
   ```
   python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
   ```
3. Under **Health Check**, set:
   - **Path:** `/health/`
   - **Timeout:** `30` seconds
4. Click **Save**

> Why the migrate step matters: if a deploy includes a new migration and the app starts before the migration runs, every database query against the new schema will 500 until someone notices and manually runs migrate. This one-line change prevents that entirely.

---

### Step 8 — Local: Install Pre-commit Hooks

**What it does:** Runs linting and security checks on your local machine before each commit, so issues are caught in seconds rather than after a CI run.

After cloning the repository or pulling the `.pre-commit-config.yaml` file:

```bash
pip install pre-commit
pre-commit install
```

From that point on, every `git commit` automatically runs the configured hooks. To run manually against all files:

```bash
pre-commit run --all-files
```

---

### Step 9 — SendGrid: API Key (when email alerts are needed)

**What it does:** Enables deadline alerts, low-stock notices, and payment reminders. Not needed until Phase 1B shipment alerts are implemented.

When ready:
1. Go to `https://sendgrid.com` and create a free account (100 emails/day free tier)
2. Go to **Settings** → **API Keys** → **Create API Key**
3. Name it `omniFreight-dev`, select **Restricted Access**, grant **Mail Send** permission only
4. Copy the key — it is only shown once
5. Add to Railway Variables:
   - `EMAIL_BACKEND` → `django.core.mail.backends.smtp.EmailBackend`
   - `SENDGRID_API_KEY` → *(paste key)*
   - `DEFAULT_FROM_EMAIL` → `noreply@yourdomain.com`
6. Update `DJANGO_SETTINGS_MODULE` to `config.settings.prod` in Railway Variables

> Keep the SendGrid key out of all files. Railway Variables only.

---

### Step 10 — AWS S3: Credentials (when document uploads are needed)

**What it does:** Enables file attachment storage (invoices, packing lists, customs docs) for shipments and payments. Not needed until Phase 1B document attachments are implemented.

When ready:
1. Log in to `https://aws.amazon.com/console`
2. Go to **IAM** → **Users** → **Create user**
3. Name: `omnifreight-s3-dev`
4. Attach policy: `AmazonS3FullAccess` (scope down to a specific bucket in production)
5. Go to **Security credentials** → **Create access key** → select **Application running outside AWS**
6. Copy the Access Key ID and Secret Access Key — shown once
7. Go to **S3** → **Create bucket**, name it `omnifreight-dev-<random-suffix>`, region `us-east-1`
8. Add to Railway Variables:
   - `AWS_ACCESS_KEY_ID` → *(paste)*
   - `AWS_SECRET_ACCESS_KEY` → *(paste)*
   - `AWS_STORAGE_BUCKET_NAME` → `omnifreight-dev-<your-suffix>`
   - `AWS_S3_REGION_NAME` → `us-east-1`

> In dev (local Docker), leave all AWS variables blank — the app falls back to local filesystem storage automatically per `.env.example`.
