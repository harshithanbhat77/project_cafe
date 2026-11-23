# Project Structure

## Project classification

**Full-stack web application** for QR-based restaurant ordering and staff operations. The repository contains a Next.js browser application, a FastAPI JSON API, PostgreSQL persistence, and Docker-based development/production deployment. README describes one deployment per restaurant.

## Functional areas

- **Guest ordering:** scan a table-specific QR token, browse/search/filter the menu, maintain a cart, submit an order, view that guest session's orders, and request a waiter or bill.
- **Service operations:** staff monitor orders and guest requests, advance or cancel orders, mark menu items sold out, and clear tables.
- **Restaurant administration:** owners edit menu sections and dishes, manage tables and QR tokens, configure branding/currency/charges, and manage staff accounts.
- **Reporting and operations:** owner daily sales summary, CLI account/demo-data commands, health endpoint, database migrations, and backup script.

## Top-level modules and layers

| Area | Tracked files | Responsibilities |
|---|---:|---|
| `backend/app/` | 22 | FastAPI application and domain code: 11 application modules plus 11 router-package files. |
| `backend/migrations/` | 7 | Alembic environment/template and five schema revisions. |
| `backend/tests/` | 10 | Pytest configuration/support and nine test modules. |
| Backend build/runtime config | 5 | Dockerfile, Docker ignore file, Alembic config, pytest config, and Python requirements. |
| `frontend/app/` | 26 | Next.js App Router routes, layouts, error/404 UI, styling, and route-level admin/guest components. |
| `frontend/components/` | 25 | Three shared application components and 22 UI primitives. |
| `frontend/lib/` | 5 | API formatting/error handling, branding, QR URLs, time helpers, and utilities. |
| Frontend build/runtime config | 9 | Dockerfile, Docker ignore file, package manifest/lockfile, Next.js/TypeScript/PostCSS config, generated Next type file, and UI component config. |
| Repository and deployment files | 8 | Compose files, Caddy config, CI workflow, environment example, README, ignore file, and backup script. |

The backend uses a conventional **router → schemas/security/dependencies → SQLAlchemy models/database** organization. Business operations such as bill calculation and restaurant settings are factored into small modules. Frontend functionality is organized by route and shared components; the admin API/session provider is in `frontend/app/admin/admin-context.tsx`.

The repository has 117 tracked files: 44 under `backend/`, 65 under `frontend/`, and 8 elsewhere. There are 38 Python files, 47 TSX files, and 9 TypeScript files.

## User-facing routes and entry points

### Browser application

- `/`: landing page and restaurant branding (`frontend/app/page.tsx`).
- `/order/[token]`: guest flow bound to a table QR token (`frontend/app/order/[token]/page.tsx`).
- `/admin`: order queue/dashboard.
- `/admin/orders/[orderId]/invoice`: authenticated invoice preview and print workflow.
- `/admin/menu`: menu and section management.
- `/admin/tables`: table status and QR management.
- `/admin/tables/print`: printable QR cards.
- `/admin/staff`: owner-only account management.
- `/admin/settings`: owner-only restaurant branding and bill settings.
- `frontend/app/layout.tsx`: root layout, metadata, fonts, and shared providers.

### API and command-line entry points

- `backend/app/main.py` creates the FastAPI app, installs CORS/security/rate-limit handling, mounts routers and uploaded images, and exposes `GET /health`.
- `backend/app/routers/public.py`: six table-token guest endpoints for menu, sessions, orders, and service requests.
- `backend/app/routers/admin_*.py` and `restaurant.py`: 25 admin routes for authentication, order processing, menu, tables, staff, uploads, and settings; public branding is also exposed by `restaurant.py`.
- `backend/app/cli.py`: `create-user` and development-only `seed-demo` commands.
- `backend/Dockerfile`: runs Alembic migrations before starting Uvicorn.
- `frontend/Dockerfile`: builds and runs Next.js standalone output.
- `docker-compose.yml` and `docker-compose.prod.yml`: local and production service graphs.
- `.github/workflows/ci.yml`: backend tests, PostgreSQL migration checks, and frontend production build.

## Main runtime flow

1. A guest opens a QR URL containing a table token. The frontend fetches that table's public menu and restaurant settings.
2. The guest provides name and phone when first ordering or requesting help. The API creates an expiring session scoped to that table.
3. Order submission sends menu item IDs and quantities; the backend reads prices from the database, computes and stores bill totals, and uses an idempotency key to prevent duplicate orders on retries.
4. The staff dashboard polls the authenticated API for orders and open requests. Staff advance order states; owners also see daily summaries and have management screens.
5. In production, Caddy serves HTTPS on one domain and routes `/api/*` and `/health` to FastAPI, with other paths sent to Next.js. PostgreSQL and application services are not publicly published.

## Cross-cutting behavior

Admin authorization is role-based (`OWNER`/`STAFF`); the backend reloads the account and role for each authenticated request. Guest requests use a separate table-bound session token. Menu photos and logos are uploaded through an owner-only endpoint and served from the API's upload directory. Rate limiting is process-local as implemented in `backend/app/limits.py`.
