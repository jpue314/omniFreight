# Vendor, Inventory & Machine Management — Design Spec

**Date:** 2026-04-28
**Status:** Approved
**Covers:** Phase 1A (Vendor + Inventory) + Phase 1C (Machine Registry), designed together because machines consume inventory.

---

## Context

The primary workflow is: *know what's low, know who to order from, place the order before you run out.* Staff don't come to the vendor page to find a phone number — they come to see what's running low and whether to reorder. The 7-day average shipping lead time makes proactive ordering critical.

A POS integration is planned for Phase 2. The data model is designed to absorb POS consumption transactions without schema changes.

---

## Architecture Decision: Two Modules + Reorder Queue (Option C)

- **Inventory** — catalog and stock ledger (source of truth for quantities)
- **Vendors** — supplier/manufacturer directory (contacts, payment terms)
- **Reorder Queue** — operational hub (low-stock items grouped by vendor, order-by countdowns)
- **Machines** — asset registry (device info, linked inks/spares)

Vendors and Inventory are kept separate but cross-linked. The Reorder Queue is the daily-use hub.

---

## Data Models

### Vendor
Inherits `TimeStampedModel`. Has `is_active = True` (bool) for soft delete — deleted vendors are hidden from lists but FKs remain intact.

| Field | Type | Notes |
|---|---|---|
| name | string | |
| type | choice | Supplier, Manufacturer, Freight Forwarder, Carrier |
| primary_contact_name | string | |
| primary_contact_email | string | |
| primary_contact_phone | string | |
| additional_contacts | JSON | Array of `{name, title, phone, email}` objects |
| payment_terms | string | e.g. Net 30, Prepay |
| preferred_payment_method | choice | Wire, ACH, Check, Card |
| website | URL | |
| portal_notes | text | Login instructions — no passwords stored |
| performance_notes | text | |

### Machine
Inherits `TimeStampedModel`.

| Field | Type | Notes |
|---|---|---|
| name | string | e.g. "Printer 1 — Roland VG3" |
| asset_id | string | Internal asset tag |
| type | choice | Printer, Cutter, Laminator, Other |
| make / model / serial_number | string | |
| manufacturer | FK → Vendor | nullable |
| purchase_date / purchase_price | date / decimal | |
| warranty_expiration | date | |
| support_contact_name / phone / email | string | |
| network_config | JSON | `{ip, hostname, snmp_community}` — Phase 2 SNMP polling reads from here |
| service_notes | text | Free-text maintenance log |
| is_active | bool | default True |

### InventoryItem
Inherits `TimeStampedModel`.

| Field | Type | Notes |
|---|---|---|
| name | string | |
| category | choice | Ink, Spare Part, Raw Material, Packaging, Other |
| sku | string | |
| unit_of_measure | string | liters, units, rolls, etc. |
| current_quantity | decimal | Denormalized cache — updated atomically with each transaction |
| min_stock_level | decimal | Reorder trigger threshold |
| reorder_quantity | decimal | How much to order |
| unit_cost | decimal | Last known purchase price |
| vendor | FK → Vendor | Primary supplier |
| reorder_url | URL | Direct link to vendor order page |
| lead_time_days | int | Used in reorder countdown calculation |
| last_ordered_date | date | Set when "Mark Ordered" is tapped in Reorder Queue |
| machine | FK → Machine | nullable — set for inks and spares tied to a specific machine |
| notes | text | |

### InventoryTransaction (the ledger)
No `TimeStampedModel` — `created_by` is the sign-off and is required (not nullable).

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| item | FK → InventoryItem | |
| type | choice | receipt, consumption, adjustment, return, initial |
| quantity | decimal | Positive = stock in, negative = stock out |
| quantity_before | decimal | Snapshot at time of transaction |
| quantity_after | decimal | Snapshot at time of transaction |
| reference | string | PO number, shipment ID, or POS sale ID (future) |
| notes | text | |
| created_at | datetime | auto |
| created_by | FK → User | Required — the person who recorded/received the stock |

**POS integration path:** A POS sale creates a transaction with `type=consumption`, `reference=POS-{sale_id}`, `created_by=<system service account>`. A dedicated "System" user (role=staff, is_active=True) is seeded via a data migration for automated transaction sources. No schema changes needed.

---

## API Endpoints

All under `/api/v1/`. All require authentication. Admin-only endpoints noted.

### Vendors
| Method | Path | Description |
|---|---|---|
| GET | `/vendors/` | List all vendors (filterable by type) |
| POST | `/vendors/` | Create vendor (admin only) |
| GET | `/vendors/{id}/` | Vendor detail |
| PATCH | `/vendors/{id}/` | Update vendor (admin only) |
| DELETE | `/vendors/{id}/` | Soft delete (admin only) |
| GET | `/vendors/{id}/items/` | All inventory items supplied by this vendor |
| GET | `/vendors/{id}/machines/` | All machines manufactured by this vendor |

### Inventory
| Method | Path | Description |
|---|---|---|
| GET | `/inventory/` | List items (filterable by category, vendor, machine, low_stock) |
| POST | `/inventory/` | Create item (admin only) |
| GET | `/inventory/{id}/` | Item detail |
| PATCH | `/inventory/{id}/` | Update item (admin only) |
| GET | `/inventory/{id}/transactions/` | Full transaction history |
| POST | `/inventory/{id}/transactions/` | Record a transaction (all staff) |
| GET | `/inventory/low-stock/` | Items at or below min_stock_level |

### Machines
| Method | Path | Description |
|---|---|---|
| GET | `/machines/` | List machines |
| POST | `/machines/` | Create machine (admin only) |
| GET | `/machines/{id}/` | Machine detail |
| PATCH | `/machines/{id}/` | Update machine (admin only) |
| GET | `/machines/{id}/items/` | All inventory items linked to this machine |

### Reorder Queue
| Method | Path | Description |
|---|---|---|
| GET | `/reorder/` | Low-stock items grouped by vendor, with order_by_date |
| POST | `/inventory/{id}/mark-ordered/` | Set last_ordered_date to today, create a transaction note |

---

## Reorder Queue Logic

The Reorder Queue is a computed view — not a stored model.

```
items = InventoryItem.objects.filter(current_quantity__lte=F('min_stock_level'))
grouped by vendor

for each item:
    order_by_date = today + days_until_stockout - lead_time_days

    where days_until_stockout:
        avg_daily_usage = sum of consumption transactions last 30 days / 30
        if avg_daily_usage > 0:
            days_until_stockout = current_quantity / avg_daily_usage
        else:
            days_until_stockout = 0  # no usage history or zero usage → treat as urgent

urgency:
    RED   — order_by_date <= today
    AMBER — order_by_date <= today + 3
    GREEN — order_by_date > today + 3
```

Average daily usage is computed on-the-fly from `InventoryTransaction` (type=consumption, last 30 days). No stored field — it updates automatically as transactions are recorded.

---

## Notification Triggers

Uses the `notify()` utility from `apps/notifications`. Called from Celery tasks.

| Trigger | Type | Who | Message |
|---|---|---|---|
| Item drops to or below `min_stock_level` | `low_stock` | All active users | "{Item} is low — {qty} {unit} remaining (min: {min}). Vendor: {vendor}" |
| `order_by_date` is today | `deadline` | All active users | "Order {Item} from {Vendor} today — {lead_time} day lead time" |
| `order_by_date` has passed | `overdue` | All active users | "Overdue: {Item} should have been ordered {N} days ago" |

"All active users" = `User.objects.filter(is_active=True)`. The Celery task calls `notify()` in a loop — one `Notification` row per user. Celery Beat runs the deadline/overdue check daily at 8am UTC. A Django signal on `InventoryTransaction.post_save` fires the low-stock check immediately when a consumption transaction is saved.

---

## Module File Structure

```
backend/apps/
├── vendors/
│   ├── models.py        — Vendor
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   └── migrations/
├── inventory/
│   ├── models.py        — InventoryItem, InventoryTransaction
│   ├── serializers.py
│   ├── views.py         — includes ReorderQueueView (no separate app needed)
│   ├── urls.py
│   ├── tasks.py         — Celery: daily deadline/overdue check
│   ├── signals.py       — post_save on InventoryTransaction → low-stock check
│   └── migrations/
└── machines/
    ├── models.py        — Machine
    ├── serializers.py
    ├── views.py
    ├── urls.py
    └── migrations/

frontend/src/pages/
├── Vendors.jsx          — List + search/filter
├── VendorDetail.jsx     — Contact info + their items + machines
├── Inventory.jsx        — Catalog list + filters
├── InventoryDetail.jsx  — Item detail + transaction history
├── ReorderQueue.jsx     — Low-stock grouped by vendor
└── Machines.jsx         — Asset list + machine detail
```

---

## Verification Checklist

- [ ] `docker-compose exec backend python manage.py migrate` runs clean
- [ ] `POST /api/v1/vendors/` creates a vendor, `GET /api/v1/vendors/` lists it
- [ ] `POST /api/v1/inventory/{id}/transactions/` with type=receipt updates `current_quantity` atomically
- [ ] `GET /api/v1/inventory/low-stock/` returns items at or below `min_stock_level`
- [ ] `GET /api/v1/reorder/` returns items grouped by vendor with urgency colour
- [ ] Recording a consumption transaction that drops item below `min_stock_level` creates a `Notification`
- [ ] Vendor detail page shows all items and machines linked to that vendor
- [ ] Machine detail page shows all linked inventory items with live stock levels
