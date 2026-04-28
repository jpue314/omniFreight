# omniFreight — System Interaction Swimlane

**Personal reference document.** Not included in deployment or production builds.
Updated at each Phase milestone. Copy freely to Notion, Obsidian, or any personal records.

---

## Version History

| Version | Date | Phase | What Changed |
|---|---|---|---|
| 1.0 | 2026-04-27 | 1A — Foundation (base) | Initial scaffold — auth, users app, Docker Compose, CI/CD pipeline |

---

## How to Read This Document

Each version contains two diagram types:

- **Component Map** — what exists and how components connect (architecture view)
- **Interaction Flows** — step-by-step message flows between components (swimlane view)

Mermaid diagrams render in GitHub, Notion, Obsidian, VS Code (with extension), and most modern markdown tools.

---

---

# v1.0 — Phase 1A: Foundation (Base Version)

> **What exists:** Project scaffold. Docker Compose stack running locally.
> Backend: `users` app with JWT auth, custom User model, role-based permissions.
> Frontend: Login page, AuthContext, placeholder Dashboard, protected routes.
> CI/CD: GitHub Actions pipeline, Railway staging, branch protection on `main`.

---

## Component Map

```mermaid
flowchart TD
    subgraph CLIENT["🖥️  Client — Browser"]
        USER((User))
        REACT["React 18 + Vite
        Tailwind CSS
        React Query
        React Router"]
    end

    subgraph STAGING["☁️  Railway — Staging"]
        subgraph DJANGO["🐍  Django 5 + DRF"]
            AUTH_EP["POST /api/v1/auth/token/
            POST /api/v1/auth/token/refresh/"]
            USER_EP["GET  /api/v1/users/me/"]
            HEALTH_EP["GET  /health/"]
        end
        CELERY["⚙️  Celery Worker
        (no active tasks yet)"]
        BEAT["🕐  Celery Beat
        (no schedules yet)"]
    end

    subgraph DATA["🗄️  Data Layer"]
        POSTGRES[("PostgreSQL 15
        omnifreight db")]
        REDIS[("Redis
        broker + result store")]
    end

    subgraph EXTERNAL["☁️  External Services — Not Yet Active"]
        SENDGRID["📧  SendGrid
        Phase 1B+"]
        S3["🗂️  AWS S3 / Hetzner Storage
        Phase 1B+"]
    end

    USER -->|"HTTPS"| REACT
    REACT -->|"POST — credentials"| AUTH_EP
    REACT -->|"GET — Bearer JWT"| USER_EP
    REACT -->|"GET"| HEALTH_EP
    AUTH_EP -->|"read/write"| POSTGRES
    USER_EP -->|"read"| POSTGRES
    DJANGO -->|"enqueue"| REDIS
    CELERY -->|"consume"| REDIS
    CELERY -->|"read/write"| POSTGRES
    BEAT -->|"schedule"| REDIS
    CELERY -.->|"Phase 1B+"| SENDGRID
    DJANGO -.->|"Phase 1B+"| S3

    style EXTERNAL fill:#f5f5f5,stroke:#ccc,color:#999
    style SENDGRID fill:#f5f5f5,stroke:#ccc,color:#999
    style S3 fill:#f5f5f5,stroke:#ccc,color:#999
```

---

## Interaction Flow 1 — Login and Token Issuance

```mermaid
sequenceDiagram
    actor User
    participant React as React Frontend
    participant Django as Django API
    participant Throttle as Rate Limiter<br/>(20 req/min)
    participant DB as PostgreSQL

    User->>React: Enter email + password
    React->>Django: POST /api/v1/auth/token/
    Django->>Throttle: Check rate limit
    alt Rate limit exceeded
        Throttle-->>React: 429 Too Many Requests
        React-->>User: Show retry message
    else Within limit
        Throttle-->>Django: Allowed
        Django->>DB: Validate credentials + fetch user
        alt Invalid credentials
            DB-->>Django: No match
            Django-->>React: 401 Unauthorized
            React-->>User: Show error message
        else Valid credentials
            DB-->>Django: User record + role
            Django-->>React: {access_token, refresh_token}
            React->>React: Store tokens in AuthContext
            React-->>User: Redirect to Dashboard
        end
    end
```

---

## Interaction Flow 2 — Authenticated API Request

```mermaid
sequenceDiagram
    actor User
    participant React as React Frontend
    participant Django as Django API
    participant JWT as JWT Validator
    participant Perms as Permission Layer
    participant DB as PostgreSQL

    User->>React: Navigate to protected page
    React->>React: Read access token from AuthContext
    React->>Django: GET /api/v1/... Authorization: Bearer <token>
    Django->>JWT: Validate token signature + expiry
    alt Token expired
        JWT-->>Django: Expired
        Django-->>React: 401 Unauthorized
        React->>Django: POST /api/v1/auth/token/refresh/
        Django-->>React: New {access_token}
        Note over React,Django: Old refresh token blacklisted (OWASP A07)
        React->>Django: Retry original request
    end
    JWT-->>Django: Valid — user_id + role
    Django->>Perms: Check role against endpoint permission
    alt Insufficient role (e.g. Staff on admin endpoint)
        Perms-->>Django: Denied
        Django-->>React: 403 Forbidden
        React-->>User: Show access denied
    else Authorized
        Perms-->>Django: Allowed
        Django->>DB: Query scoped to request.user
        DB-->>Django: Records
        Django-->>React: {data, meta}
        React-->>User: Render page
    end
```

---

## Interaction Flow 3 — Token Refresh and Blacklist

```mermaid
sequenceDiagram
    participant React as React Frontend
    participant Django as Django API
    participant JWT as SimpleJWT
    participant Blacklist as Token Blacklist
    participant DB as PostgreSQL

    React->>Django: POST /api/v1/auth/token/refresh/ {refresh_token}
    Django->>JWT: Validate refresh token
    JWT->>Blacklist: Check if token is blacklisted
    alt Token is blacklisted
        Blacklist-->>JWT: Rejected
        JWT-->>Django: Invalid
        Django-->>React: 401 — session expired
        React-->>React: Clear AuthContext, redirect to Login
    else Token valid and not blacklisted
        Blacklist-->>JWT: Clear
        JWT-->>Django: Valid
        Django->>DB: Issue new access + refresh tokens
        Django->>Blacklist: Blacklist old refresh token
        Note over Django,Blacklist: Prevents reuse of stolen refresh tokens
        Django-->>React: {new_access_token, new_refresh_token}
        React->>React: Update AuthContext
    end
```

---

## Interaction Flow 4 — CI/CD Pipeline (every PR)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GitHub as GitHub
    participant CI as GitHub Actions CI
    participant Railway as Railway Staging

    Dev->>GitHub: git push feature/xxx
    Dev->>GitHub: Open Pull Request → main
    GitHub->>CI: Trigger ci.yml

    par Parallel CI jobs
        CI->>CI: backend-tests (pytest)
    and
        CI->>CI: backend-lint (ruff)
    and
        CI->>CI: backend-sast (bandit)
    and
        CI->>CI: backend-deps (pip-audit)
    and
        CI->>CI: migration-check
    and
        CI->>CI: frontend-build (vite build)
    and
        CI->>CI: frontend-deps (npm audit)
    end

    alt Any job fails
        CI-->>GitHub: Mark checks failed
        GitHub-->>Dev: Block merge — show failed job
    else All jobs pass
        CI-->>GitHub: Mark checks passed
        GitHub-->>Dev: PR ready for review
        Dev->>GitHub: Request review / self-approve
        Dev->>GitHub: Merge PR to main
        GitHub->>Railway: Push to main detected
        Railway->>Railway: Run manage.py migrate
        Railway->>Railway: Start gunicorn
        Railway->>Railway: Health check GET /health/
        Railway-->>GitHub: Deploy complete
    end
```

---

## Interaction Flow 5 — Background Task (Celery — No Active Tasks in Phase 1A)

```mermaid
sequenceDiagram
    participant Beat as Celery Beat
    participant Redis
    participant Worker as Celery Worker
    participant DB as PostgreSQL
    participant Email as SendGrid<br/>(Phase 1B+)

    Note over Beat,Email: No scheduled tasks active in Phase 1A.<br/>This flow activates in Phase 1B when deadline alerts are added.

    Beat->>Redis: Enqueue scheduled task (e.g. check_deadlines)
    Redis->>Worker: Deliver task payload
    Worker->>DB: Query records matching alert criteria
    DB-->>Worker: Matching records
    Worker->>Email: Send alert email per record
    Email-->>Worker: 202 Accepted
    Worker->>DB: Log task run + timestamp
```

---

---

# Upcoming Versions (added when each milestone ships)

```
v1.1 — Phase 1A Complete
  + Vendor management endpoints
  + Inventory catalog endpoints
  + All /api/v1/vendors/ and /api/v1/inventory/ flows added

v1.2 — Phase 1B: Shipment Tracker
  + Shipment lifecycle flows (Ordered → Delivered status pipeline)
  + Document upload flow (S3 presigned URL pattern)
  + Deadline alert flow (Celery Beat → SendGrid activated)
  + Component map updated: SendGrid + S3 go live

v1.3 — Phase 1C: Payments & Machines
  + Payment tracker flow (status transitions + audit log)
  + Payment alert flow (7-day / 3-day / due-date reminders)
  + Machine asset + critical spares flows

v1.4 — Phase 1D: SOP & Dashboards
  + SOP contextual link flow (low stock alert → reorder SOP)
  + Dashboard widget data aggregation flow
  + Predictive reorder calculation flow (Celery task)

v2.0 — Production Migration (Hetzner VPS)
  + Railway replaced by Hetzner VPS in component map
  + Nginx added as reverse proxy layer
  + AWS S3 optionally replaced by Hetzner Object Storage
  + CI/CD deploy-prod.yml workflow added
```
