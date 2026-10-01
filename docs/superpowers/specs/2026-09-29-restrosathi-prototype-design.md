# RestroSathi Prototype — Design Spec (v2)

- **Date:** 2026-09-29 (v2: 2026-10-01)
- **Author:** Hariom Kumar (with Claude)
- **Status:** v2: review decisions applied
- **Changes from v1:** billing added; target market fixed (restaurants with no existing system); canonical order state machine; menu variants and add-ons; voids and audit log; customer sees bill amount only (online payment deferred); phone OTP over WhatsApp; staff-screen reliability; stages renumbered into phases; single restaurant, single codebase; bookings concurrency; security and testing additions.

---

## 1. Context and goals

**What:** A branded, mobile-first website, in-restaurant ordering system **and billing system** that Hariom builds and sells to individual restaurants in India.

**Target customer:** restaurants that **do not use any software today** (manual bills, no POS). RestroSathi is their first system, so it must cover ordering, kitchen flow and billing, not sit alongside another POS.

**This spec covers:** a prototype for **one restaurant**, in **one codebase**. Support for multiple restaurants is the next phase after this spec and is out of scope here.

**Success criteria (measurable):**
- A QR order appears on the staff board within **5 s** of being placed.
- `/menu` and `/t/[code]` load in **under 3 s** on a throttled 4G profile, with **≤ 150 KB** gzipped first-load JS.
- A full dine-in cycle works with **zero manual database edits**: scan QR → order → accept → served → bill → settle → printed bill → table free.
- Staff can bill a walk-in or takeaway customer who never scanned a QR code.
- A day-end report matches the sum of settled bills to the paisa.
- Rebranding touches only: `src/brand/theme.css`, `public/brand/*`, the Settings row (name, address, hours, about text) and `prisma/seed.ts`.

### Decisions

| Topic | Decision | Why |
|---|---|---|
| Codebase | Single repo, single restaurant. Multi-restaurant config comes in the next phase | Keep the prototype simple; avoid fork drift entirely |
| Stack | Next.js (App Router, TypeScript) full-stack + Tailwind CSS v4 + shadcn/ui + Motion; PostgreSQL via Prisma | One app to run and deploy |
| Python / FastAPI | Not used now; later only for custom ML | All AI features are hosted-API calls |
| Auth | Custom: Node `crypto.scrypt` password hashes, DB-backed session tokens in httpOnly cookies; staff **PIN login** | No auth library needed for two roles |
| i18n | next-intl, cookie-based locale (`en`, `hi`, fallback `en`); DB text stored as `{ en, hi? }` | Hindi + English from day one |
| WhatsApp | **WA-AKG only** (self-hosted, Baileys-based) on a spare SIM. No official API in this version | Owner's decision; ban risk accepted for the prototype |
| WhatsApp interface | `notify(kind, to, params)`: message kinds, not raw text; text templates live in `messages/*.json` | One place for wording; easier provider change later |
| Marketing sends | Generated as **wa.me click-to-chat links** opened on the owner's own phone, never through WA-AKG | Zero ban risk to the WA-AKG number |
| Phone verification | 6-digit **OTP sent over WhatsApp via WA-AKG**. httpSMS is a later fallback behind the same function | Already in the stack |
| Customer payments | Customer sees **bill amount only** (itemised + total). No pay button. Online payment is future scope | Owner's decision |
| Billing | Staff settle bills and record payment method(s) (Cash / UPI / Card). Sequential invoice numbers, configurable tax mode, 80 mm print | Target restaurants have no other billing system |
| Live updates | Staff board polls every **3 s** | Simple and reliable for one restaurant |
| QR security | Random table codes + **staff accept every order**. Per-device session binding is deferred until after a real-restaurant test | Owner's decision |
| AI provider | Anthropic Claude (Haiku-class) via the official TypeScript SDK, wrapped in `src/lib/ai/` | Swappable in one module |
| Demo brand | Fictional **"Saffron Tadka"** | No real brand without permission |

### Out of scope (this version)
Multiple restaurants, customer online payment / payment gateway / UPI links, per-device QR session binding, official WhatsApp API, online delivery or takeaway ordering by customers, menu-from-photo AI, AI translate button, forecasting, n8n, Reserve with Google, aggregator integration, inventory, gift vouchers, service charge.

---

## 2. Phases

Each phase ends deployable and demo-able. Navigation links and CTAs for features from later phases are **hidden** (one `FEATURES` constant), never shown as non-working buttons.

| Phase | Name | Delivers |
|---|---|---|
| 0 | Foundation | Repo, app skeleton, brand tokens, DB, i18n, auth (password + PIN), CI, test harness |
| 1 | Menu + public website | Menu with variants and add-ons, menu editor, settings editor, home, menu page, SEO, image upload |
| 2 | QR ordering + kitchen board | Tables + QR sheet, dining sessions, cart, order placement, state machine, staff board with reliability features, KOT print, call waiter / request bill, customer bill view (amount only), AI menu assistant, **first VPS deploy (sell-able demo)** |
| 3 | Billing | Staff-entered orders (table + takeaway), bill generation, tax modes, discounts, invoice numbers, voids and cancellations with audit, settlement with payment methods, 80 mm bill print, day-end report |
| 4 | WhatsApp, OTP, bookings, events | WA-AKG service, `notify()` + outbox, OTP verification, table bookings with capacity and concurrency control, event packages and enquiries, reminders, AI auto-reply |
| 5 | Customers + growth | Customer list, consent records, loyalty ledger, feedback + Google review link, owner dashboard, AI feedback summary, AI weekly report, AI marketing drafts via wa.me |
| 6 | Go-live hardening | Off-site backups + restore test, monitoring, load test, privacy page, real-device tests, pilot checklist |

---

## 3. Architecture

```
            ┌──────────────── VPS (Docker Compose) ───────────────────┐
 Customer ──┤  Caddy (HTTPS) ──► Next.js app ──► PostgreSQL           │
 Staff    ──┤                       │  ▲                               │
 Owner    ──┤                       │  │ webhook (secret, internal net) │
            │                       ▼  │                               │
            │                    WA-AKG (internal only) ──► WhatsApp    │
            │   cron ──► POST /api/cron/* (outbox, reminders, reports)  │
            └──────────────────────────────────────────────────────────┘
                                  └──► Anthropic API (src/lib/ai)
```

**Surfaces:** public (`/`, `/menu`, `/book`, `/events`, `/feedback/[token]`), table (`/t/[code]`), staff and owner (`/admin/*`), login (`/login`).

**Module boundaries:** each `src/lib/<area>/` folder owns its rules and is the only code that touches its tables:
`auth`, `menu`, `orders`, `billing`, `whatsapp`, `otp`, `bookings`, `customers`, `ai`, `audit`, `i18n`, `money`.

**Hosting:** one VPS; Compose services `app`, `postgres`, `wa-akg`, `caddy`. WA-AKG is on the internal Docker network only. Cron calls `/api/cron/*` with a bearer secret.

---

## 4. Brand and visual system

- Tokens in `src/brand/theme.css` as CSS variables mapped into Tailwind v4 `@theme`. Components use tokens only, never raw hex.
- 4 px spacing scale, fixed type scale, motion durations `fast` 150 ms and `base` 250 ms; all motion disabled under `prefers-reduced-motion`.
- **WCAG 2.2 AA:** visible focus; contrast ≥ 4.5:1 (≥ 3:1 large text); descriptive labels; keyboard + touch; targets ≥ 44 px; `<html lang>` follows the selected locale; form errors and new staff orders announced via `aria-live`.
- Every interactive component defines default, hover, focus-visible, active, disabled, loading and error states.
- Mobile-first; 360 px width; no horizontal scroll with long Hindi strings.

---

## 5. Menu

- **Category** → **MenuItem**. An item has either a base price or **variants** (e.g. Half / Full, Regular / Large), each with its own price.
- **Modifier groups** per item (e.g. "Extras", min 0 max 3; "Spice", min 1 max 1), each with **options** carrying a price delta (≥ 0).
- Line price = (variant price or base price) + sum of chosen option deltas. The server always recomputes it; client prices are never trusted.
- Sold out today (`available = false`) hides the Add button and is enforced at order time.
- Category delete is blocked while it has items. Prices must be > 0.

---

## 6. Customer experience

### Public site
Home (hero, story, signature dishes, hours, Google Maps embed, Google review link, floating Call + WhatsApp-chat buttons), Menu (category tabs, search, veg filter, spice, tags, photos, sold-out badges), Book a table and Events (Phase 4), SEO metadata + Restaurant JSON-LD. Hindi/English toggle on every page.

### QR table ordering (`/t/[code]`)
1. Scan → menu with table label; no login.
2. Choose variant and add-ons, add per-line note, add to cart (bottom sheet); "goes well with" suggestions.
3. Name optional; phone optional for ordering (required and OTP-verified only for loyalty, from Phase 5).
4. Place order → customer sees **Received → Preparing → Ready → Served**. Later rounds join the same dining session.
5. **Call waiter** and **Request bill** buttons.
6. **Bill view: itemised lines, tax, total amount only.** No payment button.

Rules: one active dining session per table (DB-enforced); a table with no open session opens one on the first order; orders are refused once the bill is settled and the session closed; while a bill is requested, new orders are still allowed and are added to the bill.

### AI menu assistant (end of Phase 2)
Grounded only in the current available menu; structured output (reply + item ids); unknown ids dropped; prices from DB; **allergy keywords** (allergy, allergic, peanut, nut, gluten, lactose, एलर्जी) are detected **before** the model is called and answered with a fixed "please confirm with staff" message; per-device daily limit (20 questions) plus atomic monthly cap; owner warned at 80 % of the cap.

---

## 7. Orders and kitchen

**Canonical order state machine** (same names in DB, API, UI and tests):

```
NEW ──accept──► PREPARING ──► READY ──► SERVED
 └──reject (reason)──► REJECTED
```
Board columns are exactly `NEW | PREPARING | READY | SERVED`. Each transition stamps `acceptedAt`, `readyAt`, `servedAt` or `rejectedAt` (+ `rejectReason`). Any other transition is refused.

**Line-level void:** an accepted line can be **voided** by staff with a reason; it leaves the bill and is written to the audit log.

**Staff-entered orders** (Phase 3): staff can add orders to a table session or a takeaway session from `/admin`; these start in `PREPARING` (no accept step).

**Staff board reliability:**
- **Start shift** button (unlocks audio, requests Screen Wake Lock).
- Sound + highlight on each new order; **escalation** if a `NEW` order is unaccepted for **2 minutes**: a louder repeating alert, plus a WhatsApp message to the owner (from Phase 4).
- "Last updated N s ago" banner turns red after 15 s without a successful poll.
- `aria-live` announcement of new orders and service requests.
- KOT print via browser print with 80 mm CSS.

---

## 8. Billing (Phase 3)

- **Dining session** kinds: `DINE_IN` (has a table) and `TAKEAWAY` (no table).
- **Bill** is generated from a session's non-rejected, non-voided lines when staff choose **Generate bill**. Lines, tax rate and totals are **snapshotted** on the bill.
- **Tax mode** (Settings):
  - `NONE`: no tax lines; document titled "Bill".
  - `COMPOSITION`: no tax collected; document titled "Bill of Supply".
  - `REGULAR`: GST at `gstRatePercent` (default 5), split equally into CGST and SGST; document titled "Tax Invoice"; GSTIN printed.
  - `pricesIncludeTax` (default true): if true, tax is extracted from the price; if false, it is added on top.
  - Owner must confirm the correct mode with their accountant; the app does not decide it.
- **Calculation order:** subtotal → discount (flat paise or percent, with reason, owner/staff per Settings) → taxable value → CGST + SGST (each rounded to the paisa) → round-off to the nearest rupee → total.
- **Invoice number:** `<FY>-<seq>` (e.g. `2026-27/0001`), sequential per financial year (1 April – 31 March), assigned inside the settlement transaction; never reused.
- **Settlement:** staff record one or more payments (`CASH`, `UPI`, `CARD`) whose sum must equal the total; then the bill is `SETTLED` and the session closed.
- **Cancellation** of a settled bill: reason required, owner only; number kept, status `CANCELLED`; audit logged.
- Printed bill (80 mm): restaurant name, address, phone, GSTIN (REGULAR), FSSAI number, document title, invoice no, date-time, table/takeaway, lines, tax, round-off, total, payment methods.
- **Day-end report:** for a date (Asia/Kolkata), settled bill count, gross, discounts, tax, net, totals by payment method, cancelled bills, voided lines.
- Customer's `/t/[code]` bill view shows lines and total only.

---

## 9. WhatsApp, OTP, bookings, events (Phase 4)

**WhatsApp (WA-AKG only):**
- `notify(kind, to, params)` writes a `MessageLog` row with status `PENDING` in the same transaction as the business action (**outbox**). A cron worker sends pending rows, retrying up to 5 times with backoff, storing `attempts`, `providerId`, `lastError`.
- Message kinds: `OTP`, `BOOKING_RECEIVED`, `BOOKING_CONFIRMED`, `BOOKING_DECLINED`, `BOOKING_REMINDER`, `EVENT_ENQUIRY_RECEIVED`, `ORDER_ESCALATION` (to owner), `THANK_YOU_FEEDBACK`, `WEEKLY_REPORT` (to owner), `STOP_CONFIRMED`, `AUTO_REPLY`.
- Incoming webhook: secret checked in constant time; duplicate message ids ignored; **group and broadcast messages ignored**; `STOP` (any case, trimmed) records an opt-out; if a human replies from the phone in a thread, AI auto-reply pauses for that thread for **12 h**.
- Banner on admin when WA-AKG reports disconnected. WA-AKG session data included in backups.

**OTP:** 6 digits, valid 10 min, max 5 attempts, max 3 sends per phone per hour; codes stored hashed. Verified phones remembered on the device for 180 days (signed cookie). Required for: booking requests, and (Phase 5) earning/redeeming loyalty.

**Phone format:** one function normalises Indian numbers to E.164 (`+91XXXXXXXXXX`), accepting spaces, dashes, a leading `0`, `91` or `+91`; anything else is rejected.

**Bookings:**
- Capacity model: **covers (seats) per slot**; slot length 30 min; each booking occupies covers for **90 min**; per-slot capacity in Settings.
- Requests do not hold capacity. **Confirm** runs in a transaction that locks the affected slots (`SELECT … FOR UPDATE`) and re-checks capacity.
- Blocked dates, booking cutoff (no requests < 60 min ahead), max party size, one active request per phone per slot.
- Customer gets a cancel link (token). Reminder sent **3 h before**; if booked less than 3 h ahead, no reminder.
- Statuses: `REQUESTED → CONFIRMED | DECLINED`; `CONFIRMED → ARRIVED | NO_SHOW | CANCELLED`.

**Events:** packages (price per plate, min guests) and enquiries (`NEW → QUOTED → CONFIRMED | LOST`). Deposits are handled offline in this version.

**AI auto-reply:** answers only from Settings and menu data (hours, address, menu, booking link); never confirms bookings, never invents offers or prices; otherwise "staff will reply shortly" + `needsHuman`.

---

## 10. Customers and growth (Phase 5)

- **Customer** (phone unique), name, birthday/anniversary optional with stated purpose.
- **ConsentRecord** (customer, purpose `MARKETING`, granted yes/no, text version, source, time). Current consent = latest record. Transactional messages don't need marketing consent.
- **LoyaltyTxn** ledger (`EARN`, `REDEEM`, `ADJUST`, `REVERSE`) with bill reference; balance = sum; redemption in a transaction that checks the balance; earn on settlement for the bill's verified phone; reversing a cancelled bill reverses its points. Defaults: 1 point per ₹100 of net total; 100 points = ₹50 off.
- **Feedback:** after settlement, `THANK_YOU_FEEDBACK` with a token link (expires in 7 days); everyone also sees the Google review link (no gating); if no phone, a QR to the feedback link is printed on the bill.
- **Dashboard:** today's sales, bills, average bill, top dishes, busy hours, upcoming bookings.
- **AI:** weekly feedback themes + draft review replies; Monday 09:00 IST weekly report via WhatsApp to owner; marketing drafts turned into per-customer wa.me links (consented customers only).

---

## 11. Data model (Prisma)

Money in **integer paise**; times stored UTC, shown Asia/Kolkata; localized text as JSON `{ en, hi? }` validated by Zod on read and write.

| Phase | Models |
|---|---|
| 0 | `Settings` (single row), `User` (name, phone?, passwordHash?, pinHash?, role `OWNER`/`STAFF`, active), `AuthSession` (tokenHash, userId, expiresAt), `LoginAttempt` (key, at), `AuditLog` (actorId?, action, entity, entityId, data JSON, at) |
| 1 | `Category`, `MenuItem` (basePricePaise?, isVeg, spiceLevel 0–3, tags[], photoUrl?, available, sortOrder), `MenuVariant` (itemId, name, pricePaise, sortOrder), `ModifierGroup` (itemId, name, min, max), `ModifierOption` (groupId, name, priceDeltaPaise), `MenuPairing` |
| 2 | `RestaurantTable` (label, code unique), `DiningSession` (kind, tableId?, status `OPEN`/`BILL_REQUESTED`/`CLOSED`, openedAt, closedAt?; **partial unique index: one non-CLOSED session per table**), `Order` (sessionId, idempotencyKey unique, source `QR`/`STAFF`, status, timestamps, rejectReason?), `OrderLine` (orderId, itemId, nameSnapshot, variantSnapshot?, modifiersSnapshot JSON, qty, unitPricePaise, note?, voidedAt?, voidReason?, voidedById?), `ServiceRequest`, `AiUsage` (month, calls), `AiDeviceUsage` (deviceId, day, calls) |
| 3 | `Bill` (sessionId unique, number?, docType, status `OPEN`/`SETTLED`/`CANCELLED`, snapshot fields, cancelReason?), `BillLine`, `Payment` (billId, method, amountPaise, recordedById), `InvoiceCounter` (fy, last) |
| 4 | `MessageLog` (direction, phone, kind, body, status `PENDING`/`SENT`/`FAILED`/`RECEIVED`, attempts, providerId?, lastError?, aiHandled, needsHuman, nextAttemptAt), `OtpCode`, `Booking`, `BlockedDate`, `EventPackage`, `EventEnquiry`, `ThreadState` (phone, aiPausedUntil?) |
| 5 | `Customer`, `ConsentRecord`, `LoyaltyTxn`, `Feedback` |

---

## 12. Security, privacy, errors

- Every server action and route handler calls `requireUser(role)`; checks live in `src/lib/auth`, not only in layouts.
- Login: 5 failures per user or IP in 15 min → 15 min lockout. Sessions expire after **12 h**. Staff PIN (4–6 digits) only works on `/login/staff`.
- Next.js server actions' built-in Origin check covers CSRF; route handlers that change data accept only same-origin POST.
- Zod on every input; request body ≤ 100 KB (uploads ≤ 5 MB, JPG/PNG/WebP only, re-encoded to WebP with `sharp`, which strips metadata).
- Rate limits keyed on **dining session / device id**, with a loose IP cap (60 orders/h per IP), never IP alone.
- Menu availability is rendered dynamically (no stale "sold out").
- Secrets only in server env vars; never logged; never in client bundles.
- Privacy page from Phase 4 (what is collected, why, AI and WhatsApp processing, retention 24 months, deletion request by WhatsApp or phone).
- WhatsApp or AI failures never block orders, bills or bookings.

---

## 13. Testing

- **Unit (Vitest):** money and billing math, tax modes, invoice numbering, line pricing with variants and modifiers, order state machine, phone normalisation, OTP rules, booking capacity, loyalty ledger.
- **Integration (Vitest + test Postgres):** server actions with auth, transactions (concurrent confirms, concurrent settlement, duplicate idempotency keys, one-session-per-table).
- **E2E (Playwright):** QR dine-in cycle; staff takeaway bill; sold-out; booking confirm (Phase 4); axe accessibility on every public page; 360 px Hindi screenshots.
- **Security tests:** `/admin` and every action reject anonymous and wrong-role users; another table's bill is not reachable by changing ids; cron routes need the secret.
- **CI:** lint, typecheck, unit, integration, E2E on every push.
- **Phase 6:** load test (20 tables ordering + 3 staff boards), restore test, real-device UPI-less flow test on low-end Android.
