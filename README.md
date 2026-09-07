# CafeFlow

QR-based cafe ordering MVP: Next.js + FastAPI + PostgreSQL + Docker.

Run `cp .env.example .env` and `docker compose up --build`.

Customer demo: `http://localhost:3000/order/demo-table-7-token`  
Admin demo: `http://localhost:3000/admin` (`admin@cafeflow.local` / `change-me-now`)  
API docs: `http://localhost:8000/docs`

Orders use server-side prices, idempotency keys, snapshots, transactions, opaque QR tokens, JWT admin auth, validated status transitions, and an Alembic migration.
