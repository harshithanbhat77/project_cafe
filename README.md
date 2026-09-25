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

- Set `ENVIRONMENT=production` (turns off `/docs`, refuses demo data).
- Put a reverse proxy with HTTPS in front (e.g. Caddy). Set `FORWARDED_ALLOW_IPS` to the proxy's IP
  so rate limits see real client IPs.
- `NEXT_PUBLIC_API_URL` is baked into the frontend at build time: set it before `docker compose build`.
- Rate-limit counters are in memory. Run a single API process, or move them to Redis.
