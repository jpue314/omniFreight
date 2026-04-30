# omniFreight Tech Stack

Personal reference — what we're using and why.

---

## Backend

### Django 5.x + Django REST Framework (DRF)
Python web framework. Django handles the database ORM, admin panel, migrations, user auth, and signals. DRF adds the REST API layer — serializers, viewsets, permissions, and the browsable API.

**Why Django:** Mature ecosystem, excellent ORM, built-in admin saves months of internal tooling work, and Python is already familiar.

### Python 3.12+
Latest stable Python. Faster than 3.11, better error messages.

### PostgreSQL 15+
Primary database. All models use UUID primary keys. Relations, JSON columns (for `network_config`, `additional_contacts`), and atomic transactions are all first-class.

**Why Postgres over SQLite:** Production-grade, handles concurrent writes, JSON column type, full-text search.

---

## Task Queue

### Celery + Redis
Celery runs background jobs — the daily 8am UTC deadline/overdue check fires via Celery Beat. Redis is the message broker (Celery jobs go in, workers pick them up).

**Why:** Long-running or scheduled work shouldn't block an HTTP request. Celery decouples it.

---

## Frontend

### React 18
Component-based UI library. We use hooks throughout (`useState`, `useEffect`, custom hooks).

### Vite
Build tool + dev server. Replaces Create React App. Starts in ~300ms, hot reloads in milliseconds. TypeScript/JSX aware out of the box.

### Tailwind CSS 3
Utility-first CSS. No separate stylesheet files — styles live in JSX className strings. Configured with a custom `brand` color palette in `tailwind.config.js`.

### TanStack React Query v5
Server state management. Handles caching, background refetching, loading/error states, and cache invalidation for all API calls. Every API endpoint has a corresponding hook in `src/lib/queries.js`.

**Why not Redux or Zustand:** Those are for client state (UI state, forms). React Query is purpose-built for server state — it handles the things Redux doesn't (stale-while-revalidate, automatic refetching, deduplication).

### React Router v6
Client-side routing. All routes defined in `App.jsx`. Uses the `<Routes>` / `<Route>` API with nested protected routes.

### Axios
HTTP client. The singleton in `src/lib/api.js` attaches the JWT `Authorization` header on every request and auto-refreshes the token on 401 responses.

---

## Auth

### Django Auth + SimpleJWT
Django handles users (model, hashing, sessions). SimpleJWT adds JWT tokens on top — `POST /api/v1/auth/token/` returns `{access, refresh}`. Access tokens are short-lived; refresh tokens are rotated and blacklisted on use.

**Flow:** Login → store access + refresh in localStorage → attach access token to every API request → on 401, auto-refresh using the refresh token → on refresh failure, redirect to `/login`.

---

## Testing

### Backend: pytest-django
Django test runner via pytest. 34 tests covering models, signals, serializers, and views.

### Frontend: Vitest + React Testing Library
Vitest runs in Vite's module graph (no separate Babel config). RTL renders components in jsdom and lets you assert on what the user sees, not implementation details.

---

## Storage

### AWS S3 (dev: local filesystem)
File uploads (future: shipment documents, SOPs) go to S3 in production. In dev, `DEFAULT_FILE_STORAGE` points to the local filesystem so no AWS credentials are needed.

---

## Dev Environment

### Docker Compose
Three services: `backend` (Django + Gunicorn), `frontend` (Vite dev server), `db` (Postgres). One command spins the whole stack:

```bash
docker-compose up --build
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:5173
- Django Admin: http://localhost:8000/admin

### Settings split
`config/settings/base.py` → `dev.py` / `prod.py`. Dev uses SQLite-alternative (Postgres in Docker), debug toolbar, and local file storage. Prod reads secrets from env vars.

---

## Deployment

### Railway
Backend deployed to Railway. `root_directory = backend`, `entrypoint.sh` handles `$PORT` binding and runs `collectstatic` + `migrate` before starting Gunicorn.

---

## API Conventions

- All endpoints under `/api/v1/`
- JWT auth: `Authorization: Bearer <access_token>` header
- Response envelope: `{data, errors, meta}` on every response
- Pagination meta: `{count, next, previous, page, page_size}`
- UUID primary keys throughout
- Soft deletes on Vendor (`.is_active = False`) — FKs stay intact
