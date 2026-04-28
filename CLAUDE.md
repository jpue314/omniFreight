# omniFreight — Claude Code Guide

## Project Purpose

omniFreight is a logistics management platform for a sign company. It replaces email/Excel/tribal knowledge with a unified hub for shipments, inventory, vendors, and payments.

**Two primary pain points it solves:**
1. Single point of failure — critical knowledge locked in one person
2. Stock visibility — reactive reordering, unknown inventory levels

Every feature should trace back to one of these two.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Django 5.x + DRF, Python 3.12+ |
| Database | PostgreSQL 15+ |
| Task Queue | Celery + Redis |
| Frontend | React 18 + Vite + Tailwind CSS |
| State | React Query |
| Auth | Django Auth + SimpleJWT |
| Storage | AWS S3 (dev: local filesystem) |
| Dev Env | Docker Compose |

## Project Structure

```
omniFreight/
├── backend/
│   ├── config/          # Django project config (settings, urls, wsgi)
│   │   └── settings/    # base.py, dev.py, prod.py
│   ├── apps/            # Django apps (users, shipments, inventory, ...)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── contexts/    # React contexts (AuthContext)
│   │   ├── components/  # Shared components
│   │   ├── pages/       # Route-level pages
│   │   └── lib/         # API client, utils
│   └── package.json
└── docker-compose.yml
```

## Dev Setup

```bash
cp .env.example .env
docker-compose up --build
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:5173
- Admin: http://localhost:8000/admin

Create a superuser:
```bash
docker-compose exec backend python manage.py createsuperuser
```

Run migrations:
```bash
docker-compose exec backend python manage.py migrate
```

## API Conventions

- All endpoints under `/api/`
- Auth: `POST /api/auth/token/` returns `{access, refresh}`
- Refresh: `POST /api/auth/token/refresh/`
- All authenticated endpoints require `Authorization: Bearer <access_token>`
- Consistent response envelope: `{data, errors, meta}` (errors only on failure)
- UUIDs as primary keys throughout

## Roles

| Role | Value | Description |
|---|---|---|
| Admin | `admin` | Full access, user management, system config |
| Staff | `staff` | View/update shipments, inventory, payments, SOPs |

## Phase Discipline

**Phase 1 only.** Do not implement Phase 2 features (vendor portal, SMS/Twilio, carrier API polling, sales platform sync, network ink sensors) until Phase 1 is in daily use.
