# CafeFlow

QR-based cafe ordering MVP: Next.js + FastAPI + PostgreSQL + Docker. One deployment per restaurant.

## Run locally

```sh
cp .env.example .env
# Fill in JWT_SECRET and POSTGRES_PASSWORD, each with: openssl rand -hex 32
docker compose up --build

# In another terminal: create your admin login and (optionally) demo data
docker compose exec api python -m app.cli create-admin --email you@example.com
docker compose exec api python -m app.cli seed-demo
```

- Customer demo: `http://localhost:3000/order/demo-table-7-token`
- Admin: `http://localhost:3000/admin`
- API docs (development only): `http://localhost:8001/docs`

The API refuses to start if `JWT_SECRET` is missing, short, or a known placeholder.

## Tests

```sh
cd backend
pip install -r requirements.txt   # Python 3.12
pytest
```

Tests use in-memory SQLite, so no database is needed.

## Security model

- **Guests** scan a table's QR code (an unguessable token) and enter their name/phone. That creates a
  session tied to that one table. It expires after `SESSION_TTL_MINUTES`, and staff can end it early.
  Guests can only order at that table and only see their own orders.
- **Staff** (`/api/admin/*`) need a JWT from `/api/admin/auth/login`. Every admin route checks it.
  Staff see every order with the customer's name and phone, so they can cancel prank orders.
- **Clear table** (`POST /api/admin/tables/{id}/clear`) ends all guest sessions at a table, e.g. when guests leave.
  **Rotate token** issues a new QR code; the old printed code stops working.
- Prices always come from the database. A retry with the same `idempotency_key` returns the
  original order instead of placing it twice.
- Rate limits: login 5/min per IP, new guest sessions 10/hour per IP per table, orders 10 per 10 min per session.
  A session can have at most 3 orders waiting for staff to accept them.

## Deploying

Production uses `docker-compose.prod.yml`. Caddy is the only public service. It serves the site and the
API on one domain, with automatic HTTPS.

1. Get a server with Docker installed, and point your domain's DNS (an `A` record) at it. Open ports 80 and 443.
2. Clone the repo and create `.env` from `.env.example`:
   - `ENVIRONMENT=production`
   - `DOMAIN=order.yourcafe.com`
   - `JWT_SECRET` and `POSTGRES_PASSWORD`: generate each with `openssl rand -hex 32`.
3. Start it:
   ```sh
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec api python -m app.cli create-admin --email owner@yourcafe.com
   ```
4. Check `https://order.yourcafe.com/health` returns `{"status":"ok"}`.

To update: `git pull && docker compose -f docker-compose.prod.yml up -d --build`. Migrations run automatically on start.

In production, `/docs` is off and `seed-demo` refuses to run. Rate-limit counters are kept in memory, so run
a single API process, or move the counters to Redis.

### Backups

`scripts/backup.sh` writes a compressed dump to `backups/` and deletes dumps older than 14 days (`KEEP_DAYS`).
Run it daily with cron, and copy `backups/` off the server (e.g. to cloud storage):

```cron
0 3 * * * cd /path/to/project_cafe && scripts/backup.sh >> backups/backup.log 2>&1
```

Restore (this replaces the current data):

```sh
gunzip -c backups/cafeflow-YYYYMMDD-HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U cafeflow cafeflow
```

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:
- the backend tests;
- the migrations against a real Postgres, plus `alembic check`, so the models and migrations can't drift apart;
- the frontend production build (includes the type-check).
