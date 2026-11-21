# CafeFlow

QR table ordering for cafes and restaurants: guests scan the code on their table, order from their phone,
and staff run service from a dashboard. Next.js + FastAPI + PostgreSQL + Docker. One deployment per restaurant.

## Run locally

```sh
cp .env.example .env
# Fill in JWT_SECRET and POSTGRES_PASSWORD, each with: openssl rand -hex 32
docker compose up --build

# In another terminal: create your admin login and (optionally) demo data
docker compose exec api python -m app.cli create-user --email you@example.com   # add --role staff for staff
docker compose exec api python -m app.cli seed-demo                              # safe to run again
```

- Guest demo: `http://localhost:3000/order/demo-table-7-token`
- Dashboard: `http://localhost:3000/admin`
- API docs (development only): `http://localhost:8001/docs`

On macOS with Colima, if `docker compose` isn't found, use the standalone `docker-compose` command instead.

### Working on the frontend

For instant reloads, run the database and API in Docker and the frontend with Node 22:

```sh
docker compose up -d db api
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Screenshots

| Guest menu | Checkout | Staff orders |
| --- | --- | --- |
| ![Guest menu](docs/screenshots/01-guest-menu.png) | ![Checkout](docs/screenshots/04-guest-cart-checkout.png) | ![Staff orders on a phone](docs/screenshots/14-dashboard-orders-phone.png) |

More in [`docs/screenshots/`](docs/screenshots/): dish details, order status, help, sign-in, menu editor, tables,
settings and printable QR cards.

## What it does

**Guests** (mobile-first, styled like a printed café menu in the restaurant's own name, logo and color)
- Scan and browse straight away, with no sign-up: section tabs that follow the page, search, and a "Veg only" filter.
- Dishes show a photo, price, veg / egg / non-veg / vegan marker, and "house favourite" and spicy notes. Tap one for details.
- Add dishes with + and −, leave a note for the kitchen, and see an estimate of service charge and tax before ordering.
  The bill always uses the server's numbers.
- Name and phone are asked for only on the first order (or help request), and remembered on that phone.
- **Your orders** shows each order's status and updates by itself.
- **Need help?** calls a waiter or asks for the bill; it shows "Staff notified" until staff mark it done.

**Staff and owners** (dashboard at `/admin`)
- **Orders**: the queue comes first. New orders appear within 5 seconds, highlighted, with an optional chime, and
  turn amber then red the longer they wait. One button moves each order along (accept, start preparing, mark ready,
  mark served). Waiter and bill requests appear at the top. Owners also see today's orders, revenue and best sellers.
- **Menu**: everyone can mark dishes sold out with a switch. Owners add and edit dishes (photo upload, price, section,
  description, diet type, spicy, bestseller) and add, rename or hide sections.
- **Tables**: see at a glance which tables are free, seated or need attention (open orders, waiter or bill requests).
  Clear a table when guests leave, and print branded QR cards. Owners add, rename or disable tables and make a new QR
  code when an old one has been shared.
- **Staff** (owner only): add staff or owners, reset passwords, change roles, deactivate people.
- **Settings** (owner only): restaurant name, logo, brand color, currency, service charge and tax, with a live preview.

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
- **Dashboard logins** (`/api/admin/*`) need a JWT from `/api/admin/auth/login`, and every admin route checks it.
  There are two roles:
  - **Staff** run service: see all orders with the customer's name/phone (so they can cancel prank
    orders), move orders along, mark items sold out, and clear tables.
  - **Owner** can also change the menu and prices, manage tables and QR codes, and add, deactivate or
    reset the password of staff accounts.
  Roles are checked against the database on every request, so deactivating someone or changing their
  role applies immediately. Owner-only routes use `dependencies=OWNER_ONLY`, and
  `tests/test_roles.py` fails if one is missing from its list.
- **Clear table** (`POST /api/admin/tables/{id}/clear`) ends all guest sessions at a table, e.g. when guests leave.
  **Rotate token** issues a new QR code; the old printed code stops working.
- Service charge and tax are set by the owner in **Settings** (the `.env` values are only the first-run defaults).
  They are calculated on the server and stored with each order, so changing a rate later doesn't change past bills.
- **Uploads** (owner only) must be real JPG, PNG or WebP images up to 5 MB. They are resized and re-saved as WebP,
  which strips location and camera data, and stored under a random name. SVGs and other files are refused.
- Prices always come from the database. A retry with the same `idempotency_key` returns the
  original order instead of placing it twice.
- Rate limits: login 5/min per IP, new guest sessions 10/hour per IP per table, orders 10 per 10 min per session,
  waiter/bill requests 6 per 10 min per session.
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
   docker compose -f docker-compose.prod.yml exec api python -m app.cli create-user --email owner@yourcafe.com
   ```
4. Check `https://order.yourcafe.com/health` returns `{"status":"ok"}`.
5. Sign in at `https://order.yourcafe.com/admin`, set your name, logo, color and tax in **Settings**, add your menu and
   tables, then print the QR codes from **Tables**.

To update: `git pull && docker compose -f docker-compose.prod.yml up -d --build`. Migrations run automatically on start.

In production, `/docs` is off and `seed-demo` refuses to run. Rate-limit counters are kept in memory, so run
a single API process, or move the counters to Redis.

### Backups

`scripts/backup.sh` writes a compressed database dump and an archive of uploaded images (menu photos, logo) to
`backups/`, and deletes backups older than 14 days (`KEEP_DAYS`).
Run it daily with cron, and copy `backups/` off the server (e.g. to cloud storage):

```cron
0 3 * * * cd /path/to/project_cafe && scripts/backup.sh >> backups/backup.log 2>&1
```

Restore (this replaces the current data):

```sh
gunzip -c backups/cafeflow-YYYYMMDD-HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U cafeflow cafeflow
docker compose -f docker-compose.prod.yml exec -T api tar -xzf - -C /data < backups/cafeflow-uploads-YYYYMMDD-HHMMSS.tar.gz
```

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:
- the backend tests;
- the migrations against a real Postgres, plus `alembic check`, so the models and migrations can't drift apart;
- the frontend production build (includes the type-check).
