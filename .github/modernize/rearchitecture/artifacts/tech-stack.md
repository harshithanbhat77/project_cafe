# Technology Stack

## Languages and runtimes

- **Backend:** Python 3.12 (`backend/Dockerfile`, CI workflow).
- **Frontend:** TypeScript/TSX; Node.js 22 in the frontend Dockerfile and CI.
- **Database:** PostgreSQL 16 Alpine in Docker Compose.
- The frontend manifest does not declare a separate Node `engines` constraint; the container and CI pin Node 22.

## Frameworks and libraries

### Backend (`backend/requirements.txt`)

| Dependency | Pinned version | Use |
|---|---:|---|
| FastAPI | 0.115.6 | HTTP API framework |
| Uvicorn `[standard]` | 0.34.0 | ASGI server |
| SQLAlchemy | 2.0.36 | ORM and database access |
| psycopg `[binary]` | 3.2.3 | PostgreSQL driver |
| Alembic | 1.14.0 | Schema migrations |
| pydantic-settings | 2.7.1 | Environment-based configuration |
| PyJWT | 2.10.1 | Admin JWTs |
| pwdlib `[argon2]` | 0.2.1 | Password hashing |
| slowapi | 0.1.9 | HTTP rate limiting |
| Pillow | 13.0.0 | Image validation and conversion |
| python-multipart | 0.0.33 | Multipart upload parsing |
| pytest | 8.3.4 | Backend tests |
| httpx | 0.28.1 | HTTP test client |
| tzdata | 2025.2 | Time-zone database |

### Frontend (`frontend/package.json`)

- **Framework/runtime libraries:** Next.js `^16.4.6`, React and React DOM `^19.3.1`.
- **Language/tooling:** TypeScript `5.7.2`, Node types `^22.20.5`, React types `^19.3.0`, PostCSS `^8.5.32`.
- **Styling/UI:** Tailwind CSS `^4.3.5`, `@tailwindcss/postcss` `^4.3.5`, Radix UI `^1.8.1`, shadcn `^4.23.0`, `class-variance-authority` `^0.7.1`, `tw-animate-css` `^1.4.0`, `vaul` `^1.1.2`.
- **Other direct dependencies:** `cn` `^0.5.2`, `lucide-react` `^1.72.0`, `qrcode` `^1.5.4`, `sonner` `^2.0.8`; `@types/qrcode` `^1.5.6`.
- The package lockfile is checked in; package manifest entries with `^` are semver ranges.

## Architecture and data access

- FastAPI routers expose JSON endpoints. Route handlers use synchronous SQLAlchemy sessions and synchronous database calls.
- Pydantic models in `backend/app/schemas.py` validate request bodies and explicitly shape API responses.
- SQLAlchemy 2 declarative models are in `backend/app/models.py`; Alembic migrations are in `backend/migrations/`.
- The Next.js App Router frontend calls FastAPI from client components using `frontend/lib/api.ts`; it is not a separate server-side API backend.
- Admin credentials are carried as a bearer JWT; guest session credentials are sent in `X-Session-Token`.

## Configuration and runtime topology

- `backend/app/config.py` loads environment settings, requires a sufficiently long non-placeholder `JWT_SECRET`, validates the configured IANA time zone, and defines database, CORS origin, session lifetime, and first-run restaurant settings.
- `.env.example` documents runtime values; restaurant settings are initialized from environment defaults and subsequently stored in the database.
- `frontend/next.config.ts` selects standalone output. `NEXT_PUBLIC_API_URL` is a build-time frontend setting.
- Development Compose publishes the web and API ports. Production Compose publishes Caddy only; Caddy routes the web/API on the same HTTPS domain and provides automatic certificate management.
- PostgreSQL data and uploaded images use named Docker volumes in the Compose configurations.

## Verification and maintenance evidence

- CI runs nine backend pytest modules, applies and downgrades/upgrades migrations against PostgreSQL 16, runs `alembic check`, and builds the frontend.
- Backend tests use in-memory SQLite according to the README; migration CI separately verifies PostgreSQL behavior.
- `scripts/backup.sh` backs up PostgreSQL and uploaded image files.
- The app provides a health endpoint that executes a database query, so it checks database reachability as well as process availability.

This document records the stack declared in repository manifests and runtime configuration; it does not assess dependency vulnerability status or select a replacement stack.
