# Data Model

Persistence is implemented with SQLAlchemy models in `backend/app/models.py` and PostgreSQL migrations in `backend/migrations/versions/`. The schema is relational, uses integer primary keys, and stores timestamps as timezone-aware `DateTime` columns. Money and rates use fixed-precision `Numeric` columns.

## Entities

| Entity / table | Fields and purpose |
|---|---|
| `User` / `users` | `id`, `name` (120), unique indexed `email` (255), `password_hash` (255), `role` (`OWNER`/`STAFF`), `active`, `created_at`, `updated_at`. Dashboard identities and role state. |
| `CafeTable` / `cafe_tables` | `id`, `name` (80), unique indexed `qr_token` (96), `active`, `created_at`, `updated_at`. Token identifies the table in a guest URL. |
| `Category` / `categories` | `id`, unique `name` (80), `description`, `active`. Has an ordered one-to-many relationship to menu items. |
| `MenuItem` / `menu_items` | `id`, `category_id`, `name` (120), `description`, `price` (`Numeric(10,2)`), nullable `image_url` (500), `available`, `active`, nullable `diet` (`VEG`/`EGG`/`NON_VEG`/`VEGAN`), `spicy`, `bestseller`. Price must be non-negative. `available` means in stock; `active` controls menu visibility. |
| `CustomerSession` / `customer_sessions` | `id`, unique indexed `session_token` (96), indexed `table_id`, `customer_name` (100), `customer_phone` (32), `active`, `created_at`, `expires_at`. Guest session is associated with one table. |
| `Order` / `orders` | `id`, `table_id`, indexed `customer_session_id`, copied `customer_name` and `customer_phone`, indexed `status`, nullable `notes`, `subtotal`, `service_charge`, `tax`, `total` (all `Numeric(10,2)`), nullable `service_charge_percent`, `tax_percent` (`Numeric(5,2)`) and `tax_label_snapshot` (20) for orders created after migration `0006`, `idempotency_key` (120), indexed `created_at`, `updated_at`. Unique constraint on `(customer_session_id, idempotency_key)`. Status: `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`. |
| `OrderItem` / `order_items` | `id`, indexed `order_id`, `menu_item_id`, `item_name_snapshot` (120), `unit_price_snapshot`, `quantity`, `line_total`. Quantity must be positive. Order deletion cascades to its line items. The name and unit price are snapshots at ordering time. |
| `ServiceRequest` / `service_requests` | `id`, indexed `table_id`, indexed `customer_session_id`, `kind` (`WAITER`/`BILL`), indexed `created_at`, nullable indexed `resolved_at`, nullable `resolved_by_id` referencing `users.id`. |
| `RestaurantSettings` / `restaurant_settings` | Single-row settings record (`id` constrained to 1): `name` (80), nullable `logo_url` (500), `accent_color` (7), `currency` (3), `service_charge_percent`, `tax_percent` (`Numeric(5,2)`), `tax_label` (20), `updated_at`. Created on first access from environment defaults. |

## Relationships

- `Category` 1 → many `MenuItem`; a menu item belongs to one category.
- `CafeTable` 1 → many `CustomerSession` and 1 → many `Order`.
- `CustomerSession` 1 → many `Order` and 1 → many `ServiceRequest`.
- `Order` 1 → many `OrderItem`; order item rows are deleted with their order.
- `MenuItem` is referenced by `OrderItem`; historical item name and price are stored separately as snapshots.
- `ServiceRequest.resolved_by_id` optionally references the staff `User` who resolved it.

## Transaction and billing behavior

- Request-scoped SQLAlchemy sessions are supplied by `backend/app/db.py`; modifying handlers commit explicitly.
- Order creation stores the order and its line items together, with a unique per-session idempotency key. A concurrent duplicate insert rolls back and returns the winning order if it exists.
- Order status changes lock the order row (`SELECT ... FOR UPDATE`) before validating the allowed transition and committing.
- `backend/app/pricing.py` calculates service charge as a percentage of subtotal, then tax as a percentage of subtotal plus service charge. Decimal arithmetic is rounded to two places using `ROUND_HALF_UP`.
- The rate amounts and item price/name snapshots are persisted on each order, so subsequent settings or menu changes do not recalculate existing bills.

## Key entities

- **CafeTable:** anchors guest access and QR links to a physical restaurant table.
- **CustomerSession:** scopes guest requests and orders to a table and an expiring session.
- **Order:** tracks a guest's submitted bill through the staff workflow.
- **OrderItem:** preserves the ordered description, quantity, and price at order time.
- **MenuItem:** stores the dish details and availability displayed to guests and staff.
- **Category:** groups menu items into guest-visible sections.
- **User:** supplies authenticated staff/owner accounts and authorization roles.
- **ServiceRequest:** records guest requests for a waiter or bill and their resolution.
