# Phase 3 Plan: Billing (Tasks 20–27)

> **For Codex:** Follow `AGENTS.md` and `docs/superpowers/plans/2026-10-02-conventions.md`. Tick checkboxes as you go. One commit per task, then the `docs/PROGRESS.md` entry. Branch: `phase-3-billing`, created from the last commit of `phase-2-qr-ordering`.
> **Spec:** sections 7 (staff-entered orders), 8 (billing), 11 (data model, Phase 3 row), 12, 13.
> **Billing is money.** Do not use design skills on the billing math, invoice numbering or settlement code. Use exact integers; no floats anywhere. If a test in this plan disagrees with your reading of the spec, do not stop: the verified vectors in this file and the spec win for behaviour; log the disagreement under "Decisions for Hariom" (No-stop protocol) and continue.

**Goal:** Staff can enter orders for a table or a takeaway customer, generate a bill with the right tax and round-off, settle it with one or more payments under a sequential invoice number, print it on an 80 mm printer, cancel it (owner), and see a day-end report that matches the bills to the paisa.

**New dependencies:** none.

**Exit criteria (all must pass):** E2E dine-in cycle ends with a printed, settled bill and a free table; takeaway bill without any QR; day-end totals equal the sum of settled bills to the paisa; two staff settling the same bill at once produce exactly one settlement; 20 concurrent settlements of different bills give invoice numbers `1…20` with no gaps or repeats; authorization matrix updated and green.

## Calculation rules (authoritative for Tasks 21–27; they restate spec section 8)

All values are integer paise. `rh(a, b) = floor((2a + b) / (2b))` is round-half-up integer division for non-negative integers. `gstBps = gstRatePercent × 100`.

1. `subtotal = Σ unitPricePaise × qty` over the bill lines.
2. Discount: none; or `FLAT` with `value` paise (1 ≤ value ≤ subtotal); or `PERCENT` with an integer percent 1–100 (`bps = percent × 100`, `discount = rh(subtotal × bps, 10000)`). A discount larger than the subtotal is an error (`DISCOUNT_EXCEEDS_SUBTOTAL`). `net = subtotal − discount`.
3. By tax mode:
   - `NONE` and `COMPOSITION`: `taxable = net`, `cgst = sgst = 0`, `beforeRound = net`.
   - `REGULAR` with `pricesIncludeTax = true`: `taxable = rh(net × 10000, 10000 + gstBps)`, `tax = net − taxable`, `cgst = floor(tax / 2)`, `sgst = tax − cgst`, `beforeRound = net`.
   - `REGULAR` with `pricesIncludeTax = false`: `taxable = net`, `tax = rh(net × gstBps, 10000)`, `cgst = floor(tax / 2)`, `sgst = tax − cgst`, `beforeRound = net + tax`.
4. `total = rh(beforeRound, 100) × 100`; `roundOff = total − beforeRound` (always between −49 and +50).
5. Document title: `NONE` → "Bill"; `COMPOSITION` → "Bill of Supply"; `REGULAR` → "Tax Invoice".
6. Invoice number: `<FY>/<seq padded to 4>` such as `2026-27/0001`; FY runs 1 April–31 March in `Asia/Kolkata`; the sequence is per FY, assigned inside the settlement transaction, never reused.

---

## Task 20: Staff-entered orders (table and takeaway)

**Files:**
- Modify: `messages/*.json`, `src/app/admin/layout.tsx` (nav: New order), `src/lib/orders/place.ts` (share the line-building code; do not duplicate pricing)
- Create: `src/lib/orders/staff-order.ts`, `src/lib/orders/staff-order.int.test.ts`, `src/app/admin/orders/new/page.tsx`, `src/app/admin/orders/new/StaffOrderForm.tsx`, `src/app/admin/orders/new/actions.ts`, `tests/e2e/staff-order.spec.ts`

**Interfaces:**
- `createStaffOrder(input, actorId): Promise<{ ok: true; orderId; sessionId } | { ok: false; error }>` with `input = { target: { type: "TABLE"; tableId } | { type: "TAKEAWAY"; customerName?: string; sessionId?: string /* add to an open takeaway */ }, idempotencyKey: uuid, items: same shape as Task 13 }`. Idempotency follows the Task 13 pattern (catch the unique violation outside the transaction).
- Orders from staff have `source = STAFF`, start in `PREPARING` with `acceptedAt = now` (no accept step), and appear on the board. Table orders join `getOrOpenTableSession`; takeaway orders call `openTakeawaySession` unless the form supplies an existing open takeaway `sessionId` (adding to a takeaway already in progress).
- Same server pricing, availability and snapshot rules as `placeOrder`. Idempotency key is enforced the same way. The action calls `requireUser()` (STAFF or OWNER). Audit `order.staff_create`.
- UI `/admin/orders/new`: choose Table (list of active tables with an "occupied" marker) or Takeaway (+ optional name), pick dishes with the same variant/add-on sheet logic as the customer page (reuse components; staff variant is denser, no photos), review, submit. Staff may order sold-out items? **No**: same rule as customers.

- [ ] **Step 1: Write failing tests.** `staff-order.int.test.ts`: table order joins the existing session; second takeaway creates a separate session; order starts `PREPARING` with `acceptedAt` set and `source STAFF`; sold-out item rejected; client price ignored; duplicate key → one order; **concurrent same key** → one order; anonymous rejected; inactive table rejected; adding to an existing takeaway session works and adding to a CLOSED session is refused (`SESSION_CLOSED`). `staff-order.spec.ts`: staff signs in, creates a takeaway order for "Rahul", sees it on the board in PREPARING, creates a table order for T3; mobile and desktop; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit, integration, e2e. Expected: PASS.
- [ ] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden` (operational screen: conservative, fast).
- [ ] **Step 6: Commit** `feat: staff-entered table and takeaway orders`, then PROGRESS.

---

## Task 21: Billing engine and tax settings

**Files:**
- Modify: `prisma/schema.prisma` (+ migration), `prisma/seed.ts`, `src/lib/settings/schema.ts`, `src/lib/settings/index.ts`, `src/lib/settings/settings.int.test.ts`, `src/app/admin/settings/*` (editor fields), `messages/*.json`, `tests/e2e/settings.spec.ts` (extend if it exists, otherwise `tests/e2e/settings-tax.spec.ts`)
- Create: `src/lib/billing/money.ts`, `src/lib/billing/calc.ts`, `src/lib/billing/calc.test.ts`, `src/lib/billing/fy.ts`, `src/lib/billing/fy.test.ts`

**Interfaces:**
- Prisma: enum `TaxMode { NONE COMPOSITION REGULAR }`; `Settings` gets `taxMode (default NONE)`, `gstRatePercent Int (default 5)`, `pricesIncludeTax Boolean (default true)`, `gstin String?`, `fssai String?`, `staffCanDiscount Boolean (default false)`, `taxModeConfirmedAt DateTime?` (set when the owner saves the tax settings in the editor; stays null until then). Seed: `taxMode NONE`, no GSTIN, no FSSAI (do **not** invent a GSTIN or FSSAI number).
- Settings validation: `gstRatePercent` integer 0–28; `gstin` must match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` when present; **`REGULAR` requires a valid GSTIN**; `fssai` is 14 digits when present. The editor shows a clear note: "Ask your accountant which mode applies to you. RestroSathi does not decide this."
- `rh(a, b)` in `money.ts` (throws on negative or non-integer input).
- `computeBill(input: { lines: Array<{ unitPricePaise: number; qty: number }>; discount?: { type: "FLAT"; valuePaise: number } | { type: "PERCENT"; percent: number }; taxMode: TaxMode; gstRatePercent: number; pricesIncludeTax: boolean }): { subtotalPaise; discountPaise; taxableValuePaise; cgstPaise; sgstPaise; taxPaise; roundOffPaise; totalPaise; docType: "BILL" | "BILL_OF_SUPPLY" | "TAX_INVOICE" }`. Throws `BillCalcError` with codes `EMPTY_BILL`, `INVALID_LINE`, `DISCOUNT_EXCEEDS_SUBTOTAL`, `INVALID_DISCOUNT`.
- `financialYear(date: Date): string` (IST; `"2026-27"`) and `formatInvoiceNumber(fy, seq): string`.

- [ ] **Step 1: Write failing tests** (`calc.test.ts`, with gst 5 % unless stated):
  1. `NONE`, one line 12345 × 1 → subtotal 12345, tax 0, total 12300, roundOff −45, docType `BILL`.
  2. `COMPOSITION`, same input → same numbers, docType `BILL_OF_SUPPLY`.
  3. `REGULAR` incl, subtotal 10500 → taxable 10000, tax 500, cgst 250, sgst 250, roundOff 0, total 10500, docType `TAX_INVOICE`.
  4. `REGULAR` excl, subtotal 10000 → taxable 10000, tax 500, cgst 250, sgst 250, total 10500.
  5. `REGULAR` excl, subtotal 3300 → tax 165, cgst 82, sgst 83, beforeRound 3465, total 3500, roundOff +35.
  6. `REGULAR` incl, subtotal 9999 → taxable 9523, tax 476, cgst 238, sgst 238, total 10000, roundOff +1.
  7. `NONE`, subtotal 12350 → total 12400, roundOff +50 (exact half rounds up).
  8. `NONE`, 20000 with `PERCENT 10` → discount 2000, total 18000.
  9. `NONE`, 3333 with `PERCENT 15` → discount 500 (499.95 rounds up), net 2833, total 2800, roundOff −33.
  10. `REGULAR` incl, 20000 with `PERCENT 10` → net 18000, taxable 17143, tax 857, cgst 428, sgst 429, total 18000.
  11. `FLAT 2500` on 20000 → total 17500; `FLAT 25000` on 20000 → throws `DISCOUNT_EXCEEDS_SUBTOTAL`; `PERCENT 0` and `PERCENT 101` → `INVALID_DISCOUNT`; empty lines → `EMPTY_BILL`; qty 0 or a non-integer price → `INVALID_LINE`.
  12. **Property test** (seeded pseudo-random, 500 cases, all modes): `cgst + sgst === tax`; `total % 100 === 0`; `-49 <= roundOff <= 50`; `total >= 0`; for `REGULAR` incl `taxable + tax === net`; for `NONE`/`COMPOSITION` `tax === 0`; all outputs are integers.
  - `fy.test.ts`: `2026-10-02` → `2026-27`; `2027-03-31T18:29:59Z` (still 31 March IST) → `2026-27`; `2027-03-31T18:30:00Z` (1 April 00:00 IST) → `2027-28`; `formatInvoiceNumber("2026-27", 7)` → `2026-27/0007`; seq 12345 → `2026-27/12345`.
  - `settings.int.test.ts`: `REGULAR` without GSTIN rejected; invalid GSTIN rejected; valid test value `27AAAAA0000A1Z5` accepted; `gstRatePercent` 29 rejected; the editor action requires OWNER.
  - e2e: owner sets `REGULAR` + test GSTIN + 5 % in `/admin/settings`, reloads, sees the saved values; saving `REGULAR` without GSTIN shows an inline error.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** engine, FY helpers, schema, migration, settings validation and editor fields (both languages).
- [ ] **Step 4: Run** unit, integration, e2e (settings). Expected: PASS.
- [ ] **Step 5: Commit** `feat: billing engine with tax modes and round-off`, then PROGRESS.

---

## Task 22: Generate bill (snapshots, discount) and bill screens

**Files:**
- Modify: `prisma/schema.prisma` (+ migration), `src/lib/orders/transitions.ts` (void refusal), `src/app/admin/layout.tsx` (nav: Bills), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts` (add new actions)
- Create: `src/lib/billing/generate.ts`, `src/lib/billing/generate.int.test.ts`, `src/lib/billing/queries.ts`, `src/app/admin/bills/page.tsx`, `src/app/admin/bills/[sessionId]/page.tsx`, `src/app/admin/bills/[sessionId]/BillPanel.tsx`, `src/app/admin/bills/actions.ts`, `tests/e2e/bill-generate.spec.ts`

**Interfaces:**
- Prisma enums `DocType { BILL BILL_OF_SUPPLY TAX_INVOICE }`, `BillStatus { OPEN SETTLED CANCELLED }`, `DiscountType { FLAT PERCENT }`.
- `Bill { id, sessionId (unique), docType, status (default OPEN), number? (unique), taxMode, gstRatePercent, pricesIncludeTax, header Json, subtotalPaise, discountType?, discountValue?, discountPaise, discountReason?, taxableValuePaise, cgstPaise, sgstPaise, roundOffPaise, totalPaise, customerName?, customerPhone?, generatedAt, generatedById, settledAt?, settledById?, cancelledAt?, cancelledById?, cancelReason? }`; `header` snapshots `{ name, address, phone, gstin?, fssai? }` from Settings at generation time.
- `BillLine { id, billId, name Json, variant Json?, modifiers Json, qty, unitPricePaise, linePaise }` (copied from non-voided lines of non-rejected orders in the session; `NEW` orders that are not yet accepted are **not** billable: the action returns `UNACCEPTED_ORDERS` listing them so staff accept or reject first).
- `generateBill(sessionId, opts: { discount?: { type; value; reason }, customerName?, customerPhone? }, actor: { id; role }): Promise<{ ok: true; billId } | { ok: false; error: "NOT_FOUND" | "SESSION_CLOSED" | "UNACCEPTED_ORDERS" | "EMPTY_BILL" | "DISCOUNT_FORBIDDEN" | "DISCOUNT_INVALID" | "BILL_LOCKED" }>`. Calling it again for a session with an `OPEN` bill **recomputes** the bill (replaces lines and totals) so later orders or voids are picked up; a `SETTLED` or `CANCELLED` bill returns `BILL_LOCKED`. Discount rules: OWNER may always apply one; STAFF only when `Settings.staffCanDiscount`; reason 3–100 characters required; validated by `computeBill`. Audit `bill.generate` (include totals) and `bill.discount`.
- `voidLine` (Task 14) now also refuses (`BILL_LOCKED`) when the session's bill is `SETTLED` or `CANCELLED`; voiding while the bill is `OPEN` is allowed and the bill must be regenerated (its `generatedAt` becomes older than the void).
- Screens (STAFF/OWNER): `/admin/bills` lists open sessions (table label or "Takeaway", opened time, amount so far, status chip: Open / Bill requested / Bill ready); `/admin/bills/[sessionId]` shows the lines, quantity, amounts, a discount control (type, value, reason; hidden when not permitted), customer name/phone fields (optional), and a **Generate bill** / **Recalculate** button, then the computed breakdown (subtotal, discount, taxable value, CGST, SGST, round-off, total). Settlement arrives in Task 23.

- [x] **Step 1: Write failing tests** (`generate.int.test.ts`): bill lines and totals match `computeBill` for a mixed session (variant + add-ons, two orders); rejected orders and voided lines are excluded; a `NEW` order blocks generation with `UNACCEPTED_ORDERS`; regenerating after another order/void updates totals and keeps one `Bill` row (unique per session); header snapshot equals the Settings at that time and does **not** change when Settings are edited later; changing tax mode in Settings after generation leaves the existing bill untouched; discount: STAFF without permission → `DISCOUNT_FORBIDDEN`, with `staffCanDiscount` → allowed, owner always allowed, missing reason → `DISCOUNT_INVALID`; empty session → `EMPTY_BILL`; closed session → `SESSION_CLOSED`; anonymous rejected; `voidLine` refused after settlement/cancel (use a directly-inserted settled bill row for this test until Task 23 exists).
  - `bill-generate.spec.ts`: staff opens a table with two orders, generates a bill, sees correct totals for tax mode `NONE` and (after setting REGULAR in the DB for that test) for `REGULAR`; applies a 10 % discount as owner; Hindi + 360 px no horizontal scroll; axe clean.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** unit, integration, e2e, and the authorization matrix. Expected: PASS.
- [x] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden` for the screens only (never the math).
- [x] **Step 6: Commit** `feat: bill generation with snapshots and discounts`, then PROGRESS.

---

## Task 23: Invoice numbers and settlement (one or more payments)

**Files:**
- Modify: `prisma/schema.prisma` (+ migration), `src/app/admin/bills/[sessionId]/BillPanel.tsx`, `src/app/admin/bills/actions.ts`, `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/billing/settle.ts`, `src/lib/billing/settle.int.test.ts`, `src/components/billing/SettleSheet.tsx`, `tests/e2e/settle.spec.ts`

**Interfaces:**
- Prisma enum `PaymentMethod { CASH UPI CARD }`; `Payment { id, billId, method, amountPaise, recordedById, at }`; `InvoiceCounter { fy String @id, last Int }`.
- `settleBill(billId, payments: Array<{ method: PaymentMethod; amountPaise: number }>, actor: { id }, opts: { expectedTotalPaise: number; now?: Date }): Promise<{ ok: true; number: string } | { ok: false; error: "NOT_FOUND" | "ALREADY_SETTLED" | "BILL_CANCELLED" | "PAYMENT_MISMATCH" | "STALE_BILL" | "INVALID_PAYMENT" }>`. One transaction, locks taken in the order from the conventions: first `lockSession` (the same advisory lock `placeOrder` takes, so no order can slip in while settling), then `SELECT … FOR UPDATE` on the bill; status must be `OPEN`; `expectedTotalPaise` must equal the stored total and the session must be unchanged since `generatedAt`: there is **no non-rejected order with `placedAt > generatedAt` (including `NEW` ones) and no line voided after `generatedAt`**, else `STALE_BILL` (staff press Recalculate); each payment is an integer > 0 with a valid method; the sum must equal `totalPaise` exactly (`PAYMENT_MISMATCH` otherwise); the number is allocated in the same transaction by `INSERT INTO "InvoiceCounter" (fy, last) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last = "InvoiceCounter".last + 1 RETURNING last`, then formatted; create `Payment` rows; set bill `SETTLED`, `number`, `settledAt`, `settledById`; close the session (`closeSession`); resolve open service requests of that session; `audit()` `bill.settle` with number, total and methods. A failed settlement must **not** consume an invoice number.
- UI: **Settle** opens a sheet showing the total and the remaining balance; quick buttons "Full amount: Cash / UPI / Card"; add several payment rows (method + amount); **Confirm** is disabled until the remaining balance is exactly 0; shows an error message per error code; on success shows the invoice number with **Print** (link to `/admin/bills/view/<billId>/print`, hidden until it exists) and **Done**.

- [ ] **Step 1: Write failing tests** (`settle.int.test.ts`):
  - single Cash payment equal to the total → `SETTLED`, number `<FY>/0001`, session `CLOSED`, table can open a new session, open service requests resolved;
  - split Cash + UPI summing to the total works; sum one paisa short or over → `PAYMENT_MISMATCH` and **no number consumed** (the next successful settlement gets the next number);
  - zero/negative/non-integer amounts → `INVALID_PAYMENT`;
  - settling twice → second is `ALREADY_SETTLED`; a cancelled bill → `BILL_CANCELLED`;
  - `expectedTotalPaise` different from stored total → `STALE_BILL`; adding an order after generation (also a still-`NEW` one) → `STALE_BILL`; after Recalculate it succeeds;
  - **two concurrent settlements of the same bill** (`Promise.all`) → exactly one `ok`, one `ALREADY_SETTLED`, exactly one set of payments, one number;
  - **20 concurrent settlements of 20 different bills** → numbers are exactly `0001…0020` (as a set), no duplicates, no gaps; run the whole test 3 times, resetting `InvoiceCounter`, `Bill` and `Payment` before each run (use `{ maxWait, timeout }` as in the conventions);
  - number resets per financial year: with a date helper (inject `now`), a settlement dated 1 April IST starts `2027-28/0001` while `2026-27` continues from its last;
  - audit row present; anonymous rejected; STAFF allowed.
  - `settle.spec.ts`: staff settles with Cash; with a split Cash + UPI; the Confirm button stays disabled until the balance is zero; the table shows as free afterwards; two browser contexts open the same bill and settle concurrently → one succeeds and the other sees an "already settled" message; mobile 360 px and Hindi without horizontal scroll; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit, integration, e2e. Run the concurrency tests three times in a row; all must pass every time.
- [ ] **Step 5: Commit** `feat: sequential invoice numbers and multi-payment settlement`, then PROGRESS.

---

## Task 24: Cancel a settled bill (owner only)

**Files:**
- Modify: `src/app/admin/bills/actions.ts`, `src/app/admin/bills/[sessionId]/BillPanel.tsx` (or a bill detail page), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/billing/cancel.ts`, `src/lib/billing/cancel.int.test.ts`, `src/lib/billing/history.ts`, `src/lib/billing/history.int.test.ts`, `src/app/admin/bills/history/page.tsx`, `src/app/admin/bills/view/[billId]/page.tsx`

**Interfaces:**
- `cancelBill(billId, reason, actor: { id; role }): Promise<{ ok: true } | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" | "NOT_SETTLED" | "ALREADY_CANCELLED" | "REASON_REQUIRED" }>`: owner only; reason 5–200 characters; allowed only for a `SETTLED` bill; sets `CANCELLED`, `cancelledAt`, `cancelledById`, `cancelReason`; the invoice number and the payment rows are kept; the table session stays `CLOSED`; `audit()` `bill.cancel` with number, total and reason. (Task 38 later extends this to reverse loyalty points.)
- `listBills({ date?, query?, status? })` (STAFF/OWNER) and the page `/admin/bills/history`: settled and cancelled bills for a date (default today IST) with invoice number, time, table/takeaway, total, status, searchable by invoice number; each row links to the detail page. Add a link from `/admin/bills`. Tests: lists only that IST day, search by number works, anonymous rejected.
- `/admin/bills/view/[billId]` (STAFF/OWNER): read-only bill detail with payments, status, and (OWNER only) a **Cancel bill** button with a confirmation dialog requiring a reason.

- [ ] **Step 1: Write failing tests.** Staff → `FORBIDDEN`; owner on an `OPEN` bill → `NOT_SETTLED`; owner on a settled bill with a 4-character reason → `REASON_REQUIRED`; success keeps `number` and payments, sets status and audit; second cancel → `ALREADY_CANCELLED`; cancelling does not free the invoice number (the next settlement continues the sequence); anonymous rejected. e2e: owner cancels from the detail page; staff sees no Cancel button and a direct POST is rejected.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: owner-only cancellation of settled bills`, then PROGRESS.

---

## Task 25: 80 mm bill print

**Files:**
- Modify: `src/components/billing/SettleSheet.tsx` and the bill detail page (Print links)
- Create: `src/lib/billing/print.ts`, `src/lib/billing/print.int.test.ts`, `src/app/admin/bills/view/[billId]/print/page.tsx`, `tests/e2e/bill-print.spec.ts`

**Interfaces:**
- `getBillPrint(billId): Promise<BillPrint | null>` (`requireUser()`), built **only from the bill snapshot** (header, lines, totals, payments), never from live Settings or menu: `{ header: { name, address, phone, gstin?, fssai? }, title: "Bill" | "Bill of Supply" | "Tax Invoice", status, number?, dateTime (IST string), where: "Table <label>" | "Takeaway", lines: Array<{ name; variant?; modifiers; qty; unitPricePaise; linePaise }>, subtotal, discount?, taxLines: Array<{ label: "CGST 2.5%" | "SGST 2.5%"; paise }> (empty unless REGULAR), taxableValue? (REGULAR), roundOff, total, payments: Array<{ method; amountPaise }> }`.
- The print page (`@page { size: 80mm auto; margin: 3mm }`) shows: restaurant name, address, phone; GSTIN only for `REGULAR`; FSSAI when set; title; invoice number and IST date-time; table or takeaway; lines (name, qty, rate, amount); subtotal; discount; taxable value and CGST/SGST (REGULAR); round-off; total in large type; payment methods and amounts; "Thank you" footer; **CANCELLED** in large text and the cancel date when cancelled. Unsettled bills print as "Draft – not paid". English by default; `?lang=hi` uses Hindi names with English fallback. Print button + optional `?autoprint=1`.

- [ ] **Step 1: Write failing tests.** `print.int.test.ts`: totals and lines equal the bill snapshot; changing Settings (name, GSTIN) after settlement does **not** change the print data; GSTIN absent for `NONE`/`COMPOSITION`; titles per mode; CGST/SGST labels use the stored rate (5 % → "CGST 2.5%"); cancelled bill flagged; payments listed; unknown id → null; anonymous rejected. `bill-print.spec.ts`: print page content fits 302 px with no horizontal scroll; under print media emulation nav is hidden; a REGULAR bill shows GSTIN and "Tax Invoice"; a NONE bill shows "Bill" and no GSTIN; cancelled shows the word CANCELLED.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: 80 mm bill print from the bill snapshot`, then PROGRESS.

---

## Task 26: Day-end report

**Files:**
- Modify: `src/app/admin/layout.tsx` (nav: Reports, owner only), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/billing/day-end.ts`, `src/lib/billing/day-end.test.ts`, `src/lib/billing/day-end.int.test.ts`, `src/app/admin/reports/day-end/page.tsx`, `tests/e2e/day-end.spec.ts`

**Interfaces:**
- `dayWindowIst(dateStr: "YYYY-MM-DD"): { from: Date; to: Date }` — `[00:00, next 00:00)` in `Asia/Kolkata` as UTC instants.
- `getDayEnd(dateStr, actor): Promise<{ date; billCount; subtotalPaise; discountPaise; taxPaise; roundOffPaise; totalPaise; byMethod: { CASH; UPI; CARD }; cancelled: { count; totalPaise }; voidedLines: { count; valuePaise }; reconciles: boolean }>` (`requireUser("OWNER")`). "Settled" bills are those with `status = SETTLED` and `settledAt` inside the window; `cancelled` counts bills with `cancelledAt` inside the window. `voidedLines` = lines with `voidedAt` inside the window (`qty × unitPricePaise`). `reconciles` is true when `totalPaise === sum(byMethod)` **and** `totalPaise === Σ bill.totalPaise` **and** for every bill the arithmetic identity holds (incl-tax: `subtotal − discount + roundOff === total`; excl-tax: `subtotal − discount + tax + roundOff === total`).
- Page `/admin/reports/day-end?date=…` (default today IST): a clear table, date picker, **Print** button with a print stylesheet (A4 and 80 mm both readable), a visible warning banner when `reconciles` is false.

- [ ] **Step 1: Write failing tests.** `day-end.test.ts`: `dayWindowIst("2026-10-02")` is `2026-10-01T18:30:00Z` to `2026-10-02T18:30:00Z`. `day-end.int.test.ts`: create 5 settled bills across modes and methods (one split payment) plus one cancelled bill and one voided line → each aggregate equals the hand-computed value to the paisa; a bill settled at 23:59 IST belongs to that day and one at 00:00 IST to the next; `byMethod` sums equal `totalPaise`; `reconciles` true; manually corrupt one payment amount in the test DB → `reconciles` false; STAFF and anonymous rejected. `day-end.spec.ts`: owner opens the report for today after a settled order and sees the same total as the bill; staff gets redirected/forbidden; Hindi 360 px.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: owner day-end report`, then PROGRESS.

---

## Task 27: Customer bill view reads the bill snapshot

**Files:**
- Modify: `src/lib/orders/session-view.ts`, `src/lib/orders/session-view.int.test.ts`, `src/components/table/BillView.tsx`, `src/components/table/StatusTracker.tsx`, `messages/*.json`, `tests/e2e/table-order.spec.ts`

**Behaviour:**
- `getSessionView(code)` adds `bill: null | { status: "OPEN" | "SETTLED"; title; lines; subtotalPaise; discountPaise; taxLines; roundOffPaise; totalPaise }`. When an `OPEN` or `SETTLED` bill exists, the customer sees the **snapshot** numbers labelled "Bill amount" (and the document title for REGULAR); when none exists it keeps showing "Amount so far" from live lines. A `CANCELLED` bill is never shown to customers. **No payment button anywhere.**
- Once the session closes (bill settled) the next status poll returns `session: null`; if the browser had orders before, the tracker shows a "Thank you for visiting" panel and clears the local cart; a later scan starts a fresh session.
- No ids of other tables or sessions are exposed; the bill block contains no invoice number until settled.

- [ ] **Step 1: Write failing tests.** Integration: with an open bill, `bill.totalPaise` equals the snapshot even if a menu price changes afterwards; no bill → `bill: null` and live amount; cancelled bill not returned; table A's code never returns table B's bill. e2e: staff generates a bill with a discount → the customer's page shows the discount and total within 5 s and has no pay button; staff settles → the customer sees "Thank you for visiting".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: customer bill view from the bill snapshot`, then PROGRESS.

---

## Phase 3 gate (after Task 27, before Phase 4)

- [ ] **Exit scenario E2E** `tests/e2e/billing-cycle.spec.ts`: (a) dine-in: customer orders, staff accepts, serves, generates a bill, settles with a split payment, prints (page loads), the table is free and a new scan opens a new session; (b) takeaway: staff creates a takeaway order with no QR, bills and settles it; (c) day-end total equals the sum of the two bills; (d) two staff contexts settle the same bill at once → one settlement.
- [ ] **Authorization matrix** updated with every billing action and route (generate, settle, cancel, print data, day-end, staff order). Cancel and day-end are owner-only and tested as STAFF.
- [ ] **Code-level security and money review:** write `docs/security/phase-3-review.md` covering: client-sent totals ignored; settlement transaction and locking; invoice numbering under failure; snapshot immutability after Settings change; cancel and discount permissions; audit rows for every money action; no float arithmetic (grep `src/lib/billing` for `Math.` other than `Math.floor`, and for `toFixed`, `parseFloat`; justify any hit); no customer access to another table's bill. Fix failures with tests first.
- [ ] Full lint, typecheck, unit, integration, e2e. Run the concurrency suites three times.
- [ ] Add to `docs/HUMAN-TODO.md`: "Ask the restaurant's accountant to confirm the tax mode, GST rate, and whether prices include tax before go-live"; "Run Strix on staging after Phase 3 billing (needs Docker + LLM key)".
- [ ] Write the **Phase 3 summary** in `docs/PROGRESS.md`.
