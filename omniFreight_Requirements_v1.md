# omniFreight — Software Requirements Document

**Freight, Inventory & Supply Chain Management Platform**

| Field | Value |
|---|---|
| Document Version | 1.0 — Draft |
| Date | April 2026 |
| Status | In Review |
| Prepared For | Sign Company — Internal |
| Platform | omniFreight Web + Mobile App |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope & Objectives](#2-scope--objectives)
3. [Users & Roles](#3-users--roles)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Integrations](#6-integrations)
7. [Technical Architecture](#7-technical-architecture)
8. [Key Data Models](#8-key-data-models)
9. [Phased Delivery Roadmap](#9-phased-delivery-roadmap)
10. [Assumptions & Constraints](#10-assumptions--constraints)
11. [Glossary](#11-glossary)

---

## 1. Executive Summary

omniFreight is a web and mobile logistics management platform designed to consolidate and automate the freight, inventory, and supply chain operations of a sign company. The platform replaces fragmented email threads, Excel spreadsheets, and tribal knowledge with a single, real-time digital hub accessible to all internal staff and select vendors.

The core goal is to eliminate single points of failure by ensuring that any team member can access critical operational information at any time — including what to order, where to order it from, what is in transit, and what payments are due.

### 1.1 Business Context

| Current Problem | Impact | omniFreight Solution |
|---|---|---|
| Shipments managed via email only | Missed deadlines, no visibility | Centralized shipment tracker with status pipeline and alerts |
| Tracking numbers stored in folders | Hard to find, no one notified of delays | Searchable tracking database with carrier integration |
| No SOPs — one person holds the process | Business stops when that person is unavailable | SOP library linked to shipments and inventory items |
| Payments delayed to vendors/forwarders | Strained vendor relationships, shipment holds | Payment tracker with due-date alerts and audit log |
| Supply reordering is person-dependent | Stockouts, machine downtime | Inventory catalog with auto low-stock alerts and reorder links |
| Everything in email and sheets | Not scalable, high error risk | Unified digital platform with dashboards and automation |

---

## 2. Scope & Objectives

### 2.1 In Scope — Phase 1

- Shipment lifecycle tracking with status pipeline and deadline alerts
- Vendor management with contacts, pricing, and reorder information
- Inventory catalog for consumables, machine supplies, and critical spares
- Machine asset registry with warranty info, part numbers, and vendor contacts
- Payment tracking with due-date alerts and audit log
- SOP library linked to workflows and inventory items
- Role-based access control (Admin, Staff, Vendor)
- Customizable dashboards per user role
- Email and in-app notifications for deadlines, low stock, and payment due dates
- Predictive reorder calculations based on incoming order volume

### 2.2 In Scope — Phase 2

- Vendor portal — limited external access for vendors to update shipment status
- Integration with sales management platform for order-driven stock forecasting
- Integration with local network/ERP for real-time printer ink and tooling consumption
- SMS/push notifications via Twilio
- Advanced analytics and reporting dashboard
- API for third-party integrations

### 2.3 Out of Scope

- Accounting or general ledger functions (not a replacement for accounting software)
- Customer-facing order portals
- HR or payroll management
- Production scheduling (may be considered in Phase 3)

---

## 3. Users & Roles

| Role | Who | Key Permissions |
|---|---|---|
| Admin | Business owner / manager | Full access — all modules, user management, system config |
| Staff | Internal team members | View and update shipments, inventory, payments, SOPs |
| Vendor *(Phase 2)* | External suppliers / freight forwarders | Read-only on assigned shipments; upload documents |

---

## 4. Functional Requirements

### 4.1 Shipment Tracker

The shipment tracker is the core module. It gives the team full visibility into every order from the moment it is placed with a vendor through final delivery.

#### 4.1.1 Shipment Record

Each shipment record must capture the following fields:

- Shipment ID (auto-generated)
- Vendor (linked to vendor record)
- Freight forwarder (linked to vendor record)
- Tracking number(s) — multiple supported per shipment
- Carrier (e.g., FedEx, DHL, freight line)
- Status — see pipeline below
- Order date, expected ship date, freight forwarder cutoff date, estimated arrival date
- Actual ship date, actual arrival date (filled when known)
- Items included in the shipment (linked to inventory items)
- Total value / invoice amount
- Attached documents (invoices, packing lists, customs docs)
- Notes / email thread summary

#### 4.1.2 Status Pipeline

| Status | Meaning | Triggers |
|---|---|---|
| Ordered | PO placed with vendor | Manual entry |
| In Production | Vendor is manufacturing/preparing | Manual entry or vendor update (Phase 2) |
| Ready to Ship | Vendor has goods ready | Manual entry; triggers freight forwarder reminder |
| Shipped | In transit from vendor | Tracking number entered; carrier API confirms pickup |
| At Freight Forwarder | Arrived at forwarder's warehouse | Manual confirmation or forwarder update |
| Cleared Customs | Customs processing complete | Manual entry |
| In Transit (Final) | En route to company | Carrier API or manual |
| Delivered | Received at company | Manual confirmation; triggers payment reconciliation check |

#### 4.1.3 Deadline Alerts

- Alert 5 days before freight forwarder cutoff date
- Alert 3 days before freight forwarder cutoff date
- Alert 1 day before freight forwarder cutoff date
- Alert when tracking shows no movement for more than 3 days
- Alert when estimated arrival date passes without status update
- All alerts delivered via email + in-app notification

---

### 4.2 Inventory & Supply Management

The inventory module replaces Excel sheets with a searchable, live database of all consumables, machine supplies, and critical spare parts.

#### 4.2.1 Inventory Item Record

- Item name and description
- Category (e.g., Ink, Tooling, Spare Part, Raw Material, Packaging)
- SKU / part number
- Unit of measure (liters, units, rolls, etc.)
- Current quantity on hand
- Minimum stock level (reorder trigger threshold)
- Reorder quantity (how much to order when triggered)
- Unit cost / last purchase price
- Supplier(s) — linked to vendor records
- Reorder URL or ordering instructions
- Lead time in days
- Last ordered date and quantity
- Notes

#### 4.2.2 Low Stock Alerts

- System checks stock levels daily (or on update)
- Alert sent when current quantity drops to or below minimum stock level
- Alert includes: item name, current qty, min qty, reorder qty, supplier name, reorder link
- Dashboard surface: critical low-stock items shown prominently on main dashboard
- Staff can acknowledge an alert or mark it as "Order Placed"

#### 4.2.3 Predictive Reorder

- System tracks average consumption rate per item based on usage logs
- When new sales orders are entered (or synced from sales platform in Phase 2), system calculates projected consumption
- Predictive alert: *"Based on current orders, [Item] will run out in approximately [X] days. Reorder lead time is [Y] days. Recommended order date: [date]."*
- Allows proactive ordering before stockouts occur

---

### 4.3 Machine Asset Registry

Tracks all production machines with their associated maintenance consumables, critical spares, and support contacts.

#### 4.3.1 Machine Record

- Machine name and type
- Make, model, serial number
- Purchase date and purchase price
- Vendor/manufacturer (linked to vendor record)
- Warranty expiration date
- Vendor support contact (name, phone, email)
- Service/maintenance log

#### 4.3.2 Critical Spares List (per Machine)

- Part name and description
- Part number (manufacturer and aftermarket if applicable)
- Recommended stock quantity
- Current stock (linked to inventory item)
- Supplier and reorder link
- Notes (e.g., "replace every 6 months", "check during quarterly maintenance")

#### 4.3.3 Ink / Consumable Tracking (per Machine)

- Ink type, color, and compatible part number
- Current cartridge/tank level (manual entry or network sensor integration in Phase 2)
- Low level alert threshold
- Estimated pages/coverage remaining
- Reorder triggered when level hits threshold

---

### 4.4 Vendor Management

Centralizes all supplier, manufacturer, and freight forwarder information so any team member can find who to contact and how.

#### 4.4.1 Vendor Record

- Company name and type (Supplier, Manufacturer, Freight Forwarder, Carrier)
- Primary contact: name, title, phone, email
- Additional contacts (e.g., sales rep, billing contact, technical support)
- Website and portal login instructions (notes only — no passwords stored)
- Payment terms (net 30, prepay, etc.)
- Preferred payment method
- Items supplied (linked inventory items)
- Performance notes / rating

---

### 4.5 Payment Tracker

Tracks all outstanding and completed payments to vendors and freight forwarders, ensuring money is transferred on time.

#### 4.5.1 Payment Record

- Payment ID (auto-generated)
- Linked shipment or purchase order (optional)
- Vendor (linked to vendor record)
- Amount and currency
- Due date
- Payment method (wire transfer, ACH, check, credit card)
- Status: Pending / Approved / Sent / Confirmed
- Date paid
- Reference number / transaction ID
- Attached receipt or remittance document

#### 4.5.2 Payment Alerts

- Alert 7 days before payment due date
- Alert 3 days before payment due date
- Alert on the due date if payment status is still Pending
- Overdue alert: daily reminder if payment is past due and not marked Sent

---

### 4.6 SOP Library

Replaces tribal knowledge with documented, versioned procedures that any staff member can follow.

#### 4.6.1 SOP Record

- Title and category (Ordering, Shipping, Payment, Maintenance, etc.)
- Step-by-step content (rich text with images supported)
- Version number and change log
- Last updated by and date
- Linked modules (e.g., SOP for "How to place an order" linked to Vendor Management + Inventory)
- Linked inventory items or machines (where applicable)

#### 4.6.2 SOP Access

- All staff can view SOPs
- Only Admins can create or edit SOPs
- SOPs surface contextually — e.g., when viewing a low-stock alert, a link to the reorder SOP appears

---

### 4.7 Dashboards

The dashboard is the first thing users see when they open omniFreight. It gives an at-a-glance view of everything that requires attention.

#### 4.7.1 Default Dashboard Widgets

- **Active Shipments** — count and list by status
- **Upcoming Deadlines** — freight forwarder cutoffs and estimated arrivals in the next 14 days
- **Payments Due** — upcoming and overdue payments
- **Low Stock Alerts** — items at or below minimum stock level
- **Predictive Reorder Alerts** — items projected to run out based on current orders
- **Recent Activity Feed** — latest updates across all modules

#### 4.7.2 Custom Dashboards

- Admins can create custom dashboards with selected widgets
- Each role gets a default dashboard layout tailored to their responsibilities
- Widgets are drag-and-drop configurable

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Dashboard and key pages must load in under 2 seconds on a standard broadband connection |
| Mobile | All core features must be fully usable on a smartphone browser (iOS Safari, Android Chrome). Mobile-first design. |
| Availability | Target 99.5% uptime. Planned maintenance windows communicated 24 hrs in advance. |
| Security | Role-based access enforced on all API endpoints. No unauthenticated access to any data. |
| Data Privacy | No customer PII stored. Vendor contact data handled with discretion and not shared externally. |
| Auditability | All creates, edits, and deletes are logged with user and timestamp. Payment records are immutable once Confirmed. |
| Scalability | Architecture must support growth to 10+ users and 1,000+ inventory items without redesign. |
| Browser Support | Latest 2 versions of Chrome, Safari, Firefox, and Edge. |
| Backup | Database backed up daily. Point-in-time recovery for last 7 days. |

---

## 6. Integrations

### 6.1 Phase 1 Integrations

| Integration | Purpose | Method |
|---|---|---|
| Email (SMTP / SendGrid) | Send deadline alerts, low-stock notices, payment reminders | Django email backend |
| Carrier Tracking APIs (FedEx, UPS, DHL) | Auto-update shipment status from tracking number | REST API polling (Celery task) |

### 6.2 Phase 2 Integrations

| Integration | Purpose | Method |
|---|---|---|
| Sales Management Platform | Pull incoming order data to drive predictive reorder calculations | REST API or CSV import |
| Local Network / Printers | Read real-time ink levels from networked printers | SNMP or manufacturer API |
| Twilio | SMS alerts for critical deadlines and stockouts | Twilio REST API |
| Vendor Portal | Allow vendors to update shipment status and upload documents | JWT-authenticated restricted API |

---

## 7. Technical Architecture

| Layer | Technology | Notes |
|---|---|---|
| Backend Framework | Django 5.x + Django REST Framework | API-first architecture |
| Language | Python 3.12+ | |
| Database | PostgreSQL 15+ | Primary data store |
| Task Queue | Celery + Redis | Background tasks: alerts, carrier polling, predictive calculations |
| Frontend | React 18 + Vite + Tailwind CSS | Single-page app consuming DRF API |
| State Management | React Query | Server state caching and synchronization |
| Authentication | Django Auth + SimpleJWT | Token-based API auth; role-based permissions |
| File Storage | AWS S3 or equivalent | Document and attachment storage |
| Containerization | Docker + Docker Compose | Local dev and deployment consistency |
| Deployment | Railway / Render / VPS | TBD based on cost and ops preference |
| Notifications | SendGrid (Phase 1), Twilio (Phase 2) | |

---

## 8. Key Data Models

### 8.1 Inventory Item

| Field | Type | Notes |
|---|---|---|
| id | UUID | Auto-generated primary key |
| name | String | Product/item name |
| category | Choice | Ink, Tooling, Spare Part, Raw Material, Packaging, Other |
| sku | String | Internal or vendor SKU |
| unit_of_measure | String | e.g., liters, units, rolls |
| current_quantity | Decimal | Updated manually or via integration |
| min_stock_level | Decimal | Triggers low-stock alert |
| reorder_quantity | Decimal | Amount to order when triggered |
| unit_cost | Decimal | Last known purchase price |
| vendor | FK → Vendor | Primary supplier |
| reorder_url | URL | Direct link to reorder from vendor |
| lead_time_days | Integer | Used in predictive reorder calculation |
| last_ordered_date | Date | |
| notes | Text | |

### 8.2 Shipment

| Field | Type | Notes |
|---|---|---|
| id | UUID | Auto-generated |
| vendor | FK → Vendor | Supplier shipping the goods |
| freight_forwarder | FK → Vendor | Forwarder handling customs/logistics |
| tracking_numbers | Array | Supports multiple tracking numbers |
| carrier | String | FedEx, DHL, USPS, etc. |
| status | Choice | See status pipeline in section 4.1.2 |
| order_date | Date | |
| expected_ship_date | Date | |
| forwarder_cutoff_date | Date | Triggers deadline alerts |
| estimated_arrival_date | Date | |
| actual_arrival_date | Date | Filled on delivery confirmation |
| total_value | Decimal | Invoice value |
| documents | File[] | Invoices, packing lists, customs docs |
| notes | Text | |

### 8.3 Payment

| Field | Type | Notes |
|---|---|---|
| id | UUID | Auto-generated |
| shipment | FK → Shipment | Optional link to a shipment |
| vendor | FK → Vendor | Payee |
| amount | Decimal | |
| currency | String | Default: USD |
| due_date | Date | Triggers payment alerts |
| paid_date | Date | Filled when payment is sent |
| method | Choice | Wire, ACH, Check, Credit Card |
| status | Choice | Pending, Approved, Sent, Confirmed |
| reference_number | String | Transaction or check number |
| documents | File[] | Receipts, remittance docs |

### 8.4 Vendor

| Field | Type | Notes |
|---|---|---|
| id | UUID | Auto-generated |
| name | String | Company name |
| type | Choice | Supplier, Manufacturer, Freight Forwarder, Carrier |
| primary_contact_name | String | |
| primary_contact_email | String | |
| primary_contact_phone | String | |
| additional_contacts | JSON | Array of contact objects |
| payment_terms | String | e.g., Net 30, Prepay |
| preferred_payment_method | Choice | Wire, ACH, Check, Credit Card |
| website | URL | |
| notes | Text | Portal instructions, performance notes |

---

## 9. Phased Delivery Roadmap

| Phase | Milestone | Key Deliverables | Est. Timeline |
|---|---|---|---|
| 1A | Foundation | Project setup, auth, user roles, vendor management, basic inventory catalog | Weeks 1–3 |
| 1B | Shipment Tracker | Shipment module, status pipeline, deadline alerts, document attachments | Weeks 4–6 |
| 1C | Payments & Machines | Payment tracker, machine asset registry, critical spares, ink tracking | Weeks 7–9 |
| 1D | SOP Library & Dashboards | SOP module, customizable dashboards, predictive reorder engine | Weeks 10–12 |
| 2A | Integrations | Carrier API polling, sales platform sync, local network ink sensors | Weeks 13–16 |
| 2B | Vendor Portal | External vendor login, shipment status updates, document uploads | Weeks 17–19 |
| 2C | Analytics | Advanced reporting, trend analysis, export to PDF/Excel | Weeks 20–22 |

---

## 10. Assumptions & Constraints

### 10.1 Assumptions

- Staff have access to smartphones or computers with modern browsers
- Internet connectivity is available at all work locations
- Vendor contact information will be migrated from existing spreadsheets during onboarding
- Initial inventory data will be imported from existing Excel files via CSV import tool
- Sales platform integration API or export format will be documented by Phase 2

### 10.2 Constraints

- Phase 1 must not require any vendor action — all data entry is internal
- Budget for third-party services (SendGrid, hosting) should be minimized during Phase 1
- No sensitive financial credentials (bank accounts, card numbers) will be stored in the system
- The system must be usable without training documentation for basic staff functions

---

## 11. Glossary

| Term | Definition |
|---|---|
| Freight Forwarder | Third-party logistics company that handles customs clearance, warehousing, and coordination of international shipments |
| Forwarder Cutoff Date | Deadline by which goods must arrive at the freight forwarder's warehouse to meet the scheduled shipping window |
| Lead Time | Number of days between placing an order and receiving the goods |
| Critical Spare | A machine component that, if it fails and is not immediately replaceable, would halt production |
| Min Stock Level | The quantity threshold below which a reorder alert is triggered |
| SOP | Standard Operating Procedure — a documented, step-by-step process for completing a task consistently |
| PO | Purchase Order — a formal document issued to a vendor to initiate a purchase |
| DRF | Django REST Framework — the Python library used to build the omniFreight API |
| Celery | A distributed task queue used for background jobs like alerts and carrier status polling |

---

*— End of Document — omniFreight SRD v1.0 | Confidential*
