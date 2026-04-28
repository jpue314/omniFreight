# omniFreight — CI/CD & GitHub Workflow Design

| Field | Value |
|---|---|
| Date | 2026-04-27 |
| Status | Approved |
| Scope | CI/CD pipeline, GitHub workflow, security hardening, API conventions |

---

## 1. Overview

This document specifies the GitHub workflow, CI/CD pipeline, and security baseline for omniFreight Phase 1. All decisions are scoped to the GitHub Flow model using Railway for development hosting, with a future migration path to Hetzner VPS for production.

Security controls in this design are implemented in compliance with the **OWASP Top 10 (2021)** and the Non-Functional Requirements defined in `omniFreight_Requirements_v1.md` Section 5, specifically:
- Role-based access enforced on all API endpoints
- No unauthenticated access to any data
- All creates, edits, and deletes logged with user and timestamp
- Architecture must support growth without redesign

---

## 2. Requirements Document Corrections

The following corrections apply to `omniFreight_Requirements_v1.md` and must be reflected when the document is next revised:

| Section | Current | Corrected |
|---|---|---|
| 6.1 Phase 1 Integrations | Carrier Tracking APIs (FedEx, UPS, DHL) listed as Phase 1 | Move to Phase 2. Phase 1 tracking is manual entry only. |
| 5. Non-Functional Requirements | No mention of OWASP compliance | Add: "All API and infrastructure controls are implemented in compliance with OWASP Top 10 (2021). See CI/CD workflow design for specific controls." |

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

## 8. Summary Checklist

### Files to create
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/feature.md`
- `.github/ISSUE_TEMPLATE/bug.md`
- `.pre-commit-config.yaml`
- `issues.md` (populated with conventions)

### Files to modify
- `backend/requirements.txt` — add `whitenoise`, `bandit`, `pip-audit`, `pre-commit`
- `backend/config/settings/base.py` — JWT blacklist, DRF throttling, whitenoise middleware, `/api/v1/` URLs
- `backend/config/settings/prod.py` — whitenoise storage backend
- `omniFreight_Requirements_v1.md` — carrier API correction, OWASP compliance note

### GitHub setup (manual, one-time)
- Enable branch protection on `main` (require PR + CI pass + 1 approval)
- Enable GitHub secret scanning (repository Settings → Security)
- Connect Railway to GitHub repository
- Set Railway start command with `migrate &&` prefix
- Configure Railway health check at `/health/`
- Create GitHub milestones: 1A, 1B, 1C, 1D
- Create GitHub labels per taxonomy above
