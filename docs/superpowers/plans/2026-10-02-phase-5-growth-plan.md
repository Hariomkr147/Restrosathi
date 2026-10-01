# Phase 5 Plan: Customers + growth (Tasks 37–43)

> **For Codex:** Follow `AGENTS.md` and `docs/superpowers/plans/2026-10-02-conventions.md`. Tick checkboxes as you go. One commit per task, then the `docs/PROGRESS.md` entry. Branch: `phase-5-growth`, created from the last commit of `phase-4-whatsapp-bookings`.
> **Spec:** sections 10 (customers and growth), 11 (data model, Phase 5 row), 12, 13.
> **Privacy rules are the point of this phase.** A customer who opted out must never appear in a marketing list. Marketing is never sent through WhatsApp automation; it is only `wa.me` links the owner opens on their own phone. AI never invents offers, numbers or facts.

**Goal:** Know who the regulars are (with consent), reward them with a loyalty ledger that can never drift, collect feedback without gating reviews, give the owner a dashboard and a weekly WhatsApp report, and draft marketing the owner sends personally.

**New dependencies:** none.

**Exit criteria (all must pass):** a customer's points balance always equals the sum of their ledger rows (property test); double redemption is impossible under concurrency; opted-out customers never appear in any marketing list or segment; cancelling a bill reverses its points; the weekly report sends once per week; erasing a customer removes their personal data but keeps bill totals; authorization matrix updated and green.

---

## Task 37: Customers, consent records, erasure

**Files:**
- Modify: `prisma/schema.prisma` (+ migration), `src/lib/otp/index.ts` (mark a phone verified on success), `src/lib/whatsapp/inbound.ts` (STOP also writes a consent record), `src/app/admin/bills/[sessionId]/BillPanel.tsx` (customer phone + OTP verify + marketing checkbox), `src/app/book/BookingForm.tsx` (marketing checkbox, unticked), `src/app/admin/layout.tsx` (nav: Customers), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/customers/index.ts`, `src/lib/customers/customers.int.test.ts`, `src/lib/customers/consent.ts`, `src/lib/customers/consent.int.test.ts`, `src/lib/customers/erase.ts`, `src/lib/customers/erase.int.test.ts`, `src/app/admin/customers/page.tsx`, `src/app/admin/customers/[id]/page.tsx`, `src/app/admin/customers/actions.ts`, `tests/e2e/customers.spec.ts`

**Interfaces:**
- Prisma: `Customer { id, phone (unique, E.164), name?, birthday? (date), anniversary? (date), verifiedAt?, createdAt }`; enums `ConsentPurpose { MARKETING }`, `ConsentSource { BILLING BOOKING WHATSAPP_STOP ADMIN }`; `ConsentRecord { id, customerId, purpose, granted, textVersion, source, at, actorId? }` (index on `customerId, purpose, at`).
- `upsertCustomer(phone, { name?, verified? })` (normalises the phone; `verified: true` sets `verifiedAt` once). `verifyOtp` success now also calls `upsertCustomer(phone, { verified: true })` so staff-side verification at the counter is stored in the database, not only in a device cookie.
- Consent: `recordConsent(customerId, granted, source, actorId?)` always appends a row with `textVersion = "marketing-v1"` (a constant tied to the message key `consent.marketing.text`; changing the text means a new version). `hasMarketingConsent(customerId)`: the **latest** record for that customer and purpose has `granted = true`. **Every place that collects consent uses an unticked checkbox with the exact consent text.** STOP from WhatsApp creates the customer if missing and records `granted = false` with source `WHATSAPP_STOP` (and keeps the `OptOut` row from Phase 4; a one-time function `syncOptOutsToConsent()` backfills `OptOut` rows as consent-denied records and is run in the migration seed step).
- `getMarketingAudience(): Customer[]` in `consent.ts` is the **only** function other code may use to list marketing recipients: latest consent granted, not in `OptOut`, phone valid. Task 43 must use it.
- `eraseCustomer(customerId, actor: { id; role })` (OWNER only): in one transaction deletes the customer's `ConsentRecord`, `LoyaltyTxn` (if the model exists), `Feedback.customerId` links, the `Customer` row, any `OptOut` row for that phone is **kept** (a deletion request must never re-enable messaging; the phone stays there only to block messages; note this in `docs/security/phase-5-review.md`); sets `Bill.customerName` and `Bill.customerPhone` to `null` for that phone; keeps bill totals, payments and invoice numbers; clears `Booking.name/phone` for past bookings to `"Deleted"`/`null`-like placeholders (phone replaced with `"+00deleted"`), `MessageLog.phone`/`body`/`params` for that phone replaced; writes `audit()` `customer.erase` **without** the phone or name in `data` (only the customer id).
- Admin `/admin/customers` (STAFF/OWNER can view; OWNER can edit consent and erase): searchable list (name or phone digits), columns name, phone, verified, visits (count of settled, non-cancelled bills with that phone), last visit, marketing consent (Yes/No/Not asked), points (after Task 38). Detail page shows bills, bookings and consent history.
- Billing: the bill panel gets an optional **customer phone** field, a **Send OTP** / **Verify** control (staff read the code the customer sees on their phone) and an unticked "Customer agrees to receive offers" checkbox with the consent text; settlement upserts the customer when a phone is present.

- [ ] **Step 1: Write failing tests.** Upsert normalises and de-duplicates (`"98765 43210"` and `"+919876543210"` → one customer); consent latest-wins (grant → revoke → grant); a consent record is appended, never updated; STOP creates a denied record; `getMarketingAudience` excludes: never-asked, revoked, STOP-ed, and invalid phones, and includes only granted ones; verification through `verifyOtp` sets `verifiedAt`; erase removes the listed data and keeps bill totals/numbers (assert before/after), keeps the `OptOut` row, writes an audit row with no PII, and is owner-only; the customers list never shows an erased customer; anonymous rejected everywhere; e2e: staff enters a phone at billing, sends OTP, verifies with the code from the fake outbox, ticks the consent box, settles; the customer then appears in the list with consent Yes; owner erases the customer.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit, integration, e2e. Expected: PASS.
- [ ] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden` for the admin screens.
- [ ] **Step 6: Commit** `feat: customers with consent records and erasure`, then PROGRESS.

---

## Task 38: Loyalty ledger (earn, redeem, reverse)

**Files:**
- Modify: `prisma/schema.prisma` (+ migration with hand-written partial unique indexes), `prisma/seed.ts`, `src/lib/settings/schema.ts` + editor (loyalty section), `src/lib/billing/calc.ts` (optional extra discount input), `src/lib/billing/generate.ts`, `src/lib/billing/settle.ts`, `src/lib/billing/cancel.ts`, `src/app/admin/bills/[sessionId]/BillPanel.tsx` (redeem control), `src/app/t/[code]/…` (Join rewards), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/loyalty/index.ts`, `src/lib/loyalty/loyalty.test.ts`, `src/lib/loyalty/loyalty.int.test.ts`, `src/components/table/JoinRewards.tsx`, `tests/e2e/loyalty.spec.ts`

**Interfaces:**
- Prisma: enum `LoyaltyKind { EARN REDEEM ADJUST REVERSE }`; `LoyaltyTxn { id, customerId, kind, points Int (signed), billId?, reversesId? (unique), note?, actorId?, at }`. Migration SQL by hand: unique `(billId)` where `kind = 'EARN'`; unique `(billId)` where `kind = 'REDEEM'`; CHECK `points <> 0`. Settings: `loyaltyEnabled Boolean (default false)`, `loyaltyEarnPer100Rupees Int (default 1)`, `loyaltyRedeemUnitPoints Int (default 100)`, `loyaltyRedeemUnitValuePaise Int (default 5000)` (defaults from the spec: 1 point per ₹100, 100 points = ₹50). Seed leaves loyalty **off**.
- The balance is **derived, never stored**: `getBalance(customerId) = SUM(points)`. `Bill` gets `loyaltyPointsRedeemed Int (default 0)` and `loyaltyDiscountPaise Int (default 0)`.
- `computeBill` accepts an optional `extraDiscountPaise` (the loyalty discount) added to the manual discount before tax; total discount may not exceed the subtotal; existing Task 21 outputs must not change when it is absent (the old tests stay green).
- `applyRedemption(billId, points, actor)`: bill must be `OPEN`, have a **verified** customer phone, points a positive multiple of `loyaltyRedeemUnitPoints`, ≤ the current balance, and the resulting discount (`points / unit × unitValuePaise`) may not exceed what is left of the subtotal; stores the draft on the bill and recomputes totals. `removeRedemption(billId)` clears it. Nothing is written to the ledger yet.
- Settlement (extends Task 23, same transaction): if the bill has a verified customer phone and loyalty is enabled: lock the customer row (`SELECT … FOR UPDATE`), re-check `balance ≥ loyaltyPointsRedeemed` (else fail `LOYALTY_BALANCE_CHANGED`, nothing is settled and no invoice number is consumed), insert the `REDEEM` row (negative points) if any, then insert the `EARN` row for `floor(totalPaise / 10000) × loyaltyEarnPer100Rupees` points (skipped when zero). One EARN and one REDEEM per bill (enforced by the partial unique indexes).
- Cancel (extends Task 24, same transaction): for each EARN/REDEEM row of the bill not yet reversed, insert a `REVERSE` row with the opposite sign and `reversesId` pointing at the original (unique, so double cancel cannot double reverse). A balance may go negative if the customer already spent earned points; that is allowed and visible.
- `adjustPoints(customerId, delta, note, actor)`: OWNER only, non-zero delta, note required (≥ 3 characters), audit `loyalty.adjust`.
- Customer side `/t/[code]` **Join rewards** (only when loyalty is enabled): phone → OTP (reuse `OtpField`) → on verification the session's `customerPhone` is set (`DiningSession.customerPhone`); `generateBill` copies it to the bill when the staff field is empty; the page then shows the points balance. Without verification nothing is earned.

- [ ] **Step 1: Write failing tests.**
  - `loyalty.test.ts` (pure helpers): earn points for totals 9999 → 0, 10000 → 1, 25000 → 2 (rate 1), rate 2 → 4; redemption discount for 100 points = 5000 paise, 200 → 10000, 150 → invalid.
  - `loyalty.int.test.ts`: settling a verified customer's ₹250 bill earns 2 points once; unverified phone earns nothing; loyalty off earns nothing; redemption of 100 points with balance 150 applies ₹50 off and after settlement the ledger is `+earned −100`; redemption above balance refused; non-multiple refused; discount larger than the remaining subtotal refused; **double redemption**: a customer with 100 points has two open bills each redeeming 100; settling both concurrently → exactly one succeeds, the other fails with `LOYALTY_BALANCE_CHANGED` and consumed no invoice number; cancelling a settled bill reverses its EARN and REDEEM exactly once (a second cancel attempt is already refused by Task 24; also call the reverse helper twice directly to prove the unique index stops duplicates); the balance after cancel returns to its pre-bill value; adjust is owner-only and audited; **property test** (seeded, 300 random sequences of earn/redeem/adjust/reverse operations for 5 customers): after every step `getBalance` equals the sum of the customer's ledger rows and equals an independently kept in-memory counter; no ledger row has `points = 0`.
  - `loyalty.spec.ts`: customer joins rewards with OTP on `/t/[code]`, orders, staff settles, customer sees points; staff applies a redemption on the next bill; Hindi 360 px; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit, integration, e2e. Re-run the concurrency tests three times.
- [ ] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden` for the redeem control; `critique` + `polish` for Join rewards. Do not run design skills on the ledger code.
- [ ] **Step 6: Commit** `feat: loyalty ledger with earn, redeem and reversal`, then PROGRESS.

---

## Task 39: Feedback links and the Google review link

**Files:**
- Modify: `prisma/schema.prisma` (+ migration), `src/lib/billing/settle.ts` (create the feedback token and queue the thank-you), `src/lib/billing/print.ts` and the print page (feedback QR), `src/lib/whatsapp/notify.ts` templates (`wa.THANK_YOU_FEEDBACK`), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/feedback/index.ts`, `src/lib/feedback/feedback.int.test.ts`, `src/app/feedback/[token]/page.tsx`, `src/app/feedback/[token]/FeedbackForm.tsx`, `src/app/feedback/[token]/actions.ts`, `src/app/admin/feedback/page.tsx`, `tests/e2e/feedback.spec.ts`

**Interfaces:**
- Prisma: `Feedback { id, billId (unique), customerId?, token (unique), tokenExpiresAt, rating Int?, comment?, submittedAt?, createdAt }`.
- At settlement (same transaction as Task 23/38): create a `Feedback` row with a 32-byte base64url token expiring in **7 days**; when the bill has a **verified** customer phone, queue `THANK_YOU_FEEDBACK` (params: first name if any, feedback link `${APP_URL}/feedback/<token>`, Google review link when set). Bills without a verified phone get a **feedback QR** (to the same link) printed at the bottom of the 80 mm bill with the text "Tell us how we did".
- `/feedback/[token]` (public): shows the restaurant name only (no bill details); rating 1–5 as large radio buttons with text labels, optional comment (≤ 500 characters), submit; **the Google review button is shown to everyone, before and after submitting, whatever the rating (no gating)** when `Settings.googleReviewUrl` is set; an expired or unknown token shows a friendly message and still offers the Google link; a second submission shows "Thanks, we already have your feedback". Rate limit per IP (20/hour) and per token.
- `submitFeedback(token, { rating, comment? })`: validates, stores once (conditional update where `submittedAt IS NULL`); concurrent double submit stores one.
- Admin `/admin/feedback` (STAFF/OWNER): latest feedback with rating, comment, date, table or takeaway; average rating for 7/30 days. (Task 41 adds AI themes here.)

- [ ] **Step 1: Write failing tests.** Settlement creates exactly one feedback row with a 7-day expiry; verified-phone bill queues the thank-you with the right link; unverified phone queues nothing; submit stores rating and comment; invalid rating (0, 6, 2.5) rejected; comment of 501 characters rejected; expired token refused (inject `now`); double submit → one stored (concurrent test); the page never exposes the invoice number or amounts; Google link present for rating 1 and rating 5 alike; the print data includes the feedback URL only when no verified phone; e2e: scan the QR URL from a printed bill → submit; Hindi 360 px; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden` + `critique` + `polish` for `/feedback/[token]` (customer-facing).
- [ ] **Step 6: Commit** `feat: feedback links with ungated Google review button`, then PROGRESS.

---

## Task 40: Owner dashboard

**Files:**
- Modify: `src/app/admin/page.tsx` (owner sees the dashboard; staff see the board shortcuts), `src/app/admin/layout.tsx`, `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/dashboard/index.ts`, `src/lib/dashboard/dashboard.test.ts`, `src/lib/dashboard/dashboard.int.test.ts`, `src/components/admin/Dashboard.tsx`, `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- `getDashboard(now?: Date, actor): Promise<{ today: { salesPaise; billCount; averageBillPaise; openSessions }; topDishes: Array<{ name; qty }> (today, and a 7-day list); busyHours: Array<{ hour: number; bills: number }> (last 14 days, IST, 24 entries); upcomingBookings: { todayCount; tomorrowCount; next: Array<{ time; name; partySize; status }> (max 5, REQUESTED and CONFIRMED) }; needsHumanCount; aiCapWarning: boolean; whatsapp: "connected" | "disconnected" | "unknown" }>` (`requireUser("OWNER")`). Settled, non-cancelled bills only; times by IST day. Average bill = `rh(sales, count)` or 0 when no bills. Top dishes group `BillLine` by the English name snapshot, summing qty, excluding voided/cancelled. Busy hours count bills by IST hour of `settledAt`.
- UI: summary tiles, a simple bar list for busy hours drawn with plain CSS/SVG (no chart library) **with an equivalent table** for screen readers, top dishes list, bookings list, banners for WhatsApp disconnected and AI cap warning. Staff users see the board and bookings shortcuts instead (no money figures). Dashboard loads in under 1 s with 1,000 bills (assert in the integration test with seeded data).

- [ ] **Step 1: Write failing tests.** `dashboard.test.ts`: IST hour bucketing, average rounding, empty-day zeros. `dashboard.int.test.ts`: seed bills across two IST days including 23:30 and 00:30 → today's totals correct; cancelled bills excluded; top dishes order and quantities; busy hours; bookings counts; STAFF and anonymous rejected; 1,000-bill seed returns within 1 s. e2e: owner sees tiles and the table equivalent; staff sees no sales figure; Hindi 360 px; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden`.
- [ ] **Step 6: Commit** `feat: owner dashboard`, then PROGRESS.

---

## Task 41: AI feedback themes and draft review replies

**Files:**
- Modify: `prisma/schema.prisma` (+ migration: `FeedbackSummary { weekStart String @id, json Json, createdAt }`), `src/app/admin/feedback/page.tsx`, `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/ai/feedback.ts`, `src/lib/ai/feedback.test.ts`, `src/lib/ai/feedback.int.test.ts`, `src/app/admin/feedback/actions.ts`, `tests/e2e/feedback-ai.spec.ts`

**Interfaces:**
- `summarizeFeedback(rangeDays = 7)` (OWNER): takes up to 100 comments from the range, **strips personal data** first (digit sequences of 7 or more, email-like strings, `@handles`), numbers them, and asks the provider for `{ themes: Array<{ title: string; sentiment: "positive" | "negative" | "mixed"; commentIndexes: number[] }> }`; validates with Zod; **counts are computed by code** from the indexes (invalid indexes dropped, duplicates removed); fewer than 5 comments → no AI call, return only plain statistics (count, average rating, rating spread). Result is stored in `FeedbackSummary` (keyed by the IST week start) and shown with a "Generated by AI from N comments" label. Uses the shared monthly cap from Task 18 (`checkAndCount`); a provider error or cap reached returns the plain statistics and a clear message.
- `draftReviewReply(feedbackId)` (OWNER): returns a polite draft (≤ 400 characters, in the language of the comment when Hindi/English) for the owner to copy; the prompt forbids promising refunds, discounts or compensation, forbids naming staff, and gets only rating + stripped comment; validation rejects drafts containing digits followed by `%`, `₹`, `Rs`, "refund", "free", or any URL; failure returns a short generic template instead. Nothing is ever posted automatically.
- UI in `/admin/feedback`: themes card (with counts and example comment ids), per-feedback **Draft reply** button, **Copy** button, a visible note that AI text must be read before use.

- [ ] **Step 1: Write failing tests** (fake provider): PII stripping unit tests (phones, emails, handles removed; normal numbers like "2 chapatis" kept); fewer than 5 comments → provider not called; counts computed by code even when the provider returns wrong or out-of-range indexes; provider error → plain statistics; cap reached → plain statistics; reply draft containing "refund" or "50%" or a URL → generic fallback; draft limited to 400 characters; non-owner rejected; e2e: owner opens feedback, generates themes (fake), drafts and copies a reply; Hindi 360 px; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: AI feedback themes and draft review replies`, then PROGRESS.

---

## Task 42: Monday 09:00 IST weekly report to the owner

**Files:**
- Modify: `prisma/schema.prisma` (+ migration: `WeeklyReportLog { weekStart String @id, sentAt }`, `Settings.ownerLocale String (default "en")`), `docker-compose.prod.yml` (cron loop adds an hourly call to `/api/cron/weekly-report`), `messages/*.json` (`wa.WEEKLY_REPORT`), settings editor (owner language), `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/reports/weekly.ts`, `src/lib/reports/weekly.test.ts`, `src/lib/reports/weekly.int.test.ts`, `src/app/api/cron/weekly-report/route.ts`, `src/app/admin/reports/weekly/page.tsx`

**Interfaces:**
- `weekWindowIst(now): { weekStart: string /* Monday YYYY-MM-DD */; from: Date; to: Date }` for the **previous** Monday-to-Sunday week in `Asia/Kolkata`.
- `buildWeeklyFacts(window)`: sales total (paise), bill count, average bill, best day, busiest hour, top 3 dishes, bookings (confirmed / no-show), average rating and feedback count, cancelled bills count, voided lines count — all computed by code.
- `renderWeeklyReport(facts, locale, insight?)`: a template (both languages) with the numbers inserted by code and formatted with `formatINR`; the optional AI **insight** is one sentence (≤ 200 characters) generated from the facts; **validated**: every number in it must appear in the facts (compare normalised digits) and it must not contain URLs or promises; otherwise it is omitted. AI failure or cap → no insight, the report still sends.
- `sendWeeklyReportIfDue({ now?, force? })`: runs only when it is **Monday, 09:00 IST or later**, no `WeeklyReportLog` row exists for that `weekStart`, and an owner alert phone is set; inserts the log row and queues `notify("WEEKLY_REPORT", ownerPhone, …)` in one transaction (a second concurrent call does nothing). `POST /api/cron/weekly-report` (cron auth) calls it; the cron loop hits it hourly and the function self-gates. OWNER page `/admin/reports/weekly` shows the last report text and a **Send test report now** button (`force`, does not write the log row).

- [ ] **Step 1: Write failing tests.** `weekly.test.ts`: `weekWindowIst` for Monday 08:59 (previous week), Monday 09:00, Sunday 23:59, and across a month boundary; template output in English and Hindi contains the right ₹ figures (`formatINR`); insight validator accepts "Dal Makhani led the week" and rejects an insight with a number not in the facts, a URL, or "free". `weekly.int.test.ts`: facts match seeded data to the paisa; sends at Monday 09:00 and not at 08:59; sends once per week even with 5 concurrent calls (inject `now`); skips when no owner phone; AI failure still sends; `force` sends without logging; STAFF/anonymous cannot use the page or force; the cron route rejects a wrong secret.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: weekly owner report over WhatsApp`, then PROGRESS.

---

## Task 43: AI marketing drafts → per-customer `wa.me` links

**Files:**
- Modify: `prisma/schema.prisma` (+ migration: `Campaign { id, name, body, segment, createdAt, createdById }`, `CampaignSend { campaignId, customerId, markedAt, @@id([campaignId, customerId]) }`), `src/app/admin/layout.tsx` (nav: Marketing, owner only), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/lib/marketing/segments.ts`, `src/lib/marketing/segments.int.test.ts`, `src/lib/marketing/links.ts`, `src/lib/marketing/links.test.ts`, `src/lib/ai/marketing.ts`, `src/lib/ai/marketing.test.ts`, `src/lib/marketing/campaigns.ts`, `src/lib/marketing/campaigns.int.test.ts`, `src/app/admin/marketing/page.tsx`, `src/app/admin/marketing/[campaignId]/page.tsx`, `src/app/admin/marketing/actions.ts`, `tests/e2e/marketing.spec.ts`

**Interfaces:**
- Segments (all start from `getMarketingAudience()` of Task 37 and may only **narrow** it): `ALL_CONSENTED`, `VISITED_30_DAYS`, `INACTIVE_60_DAYS`, `BIRTHDAY_THIS_MONTH`. `listSegment(segment, now?)` returns customers with name and phone; customers who received **any** campaign in the last 7 days are excluded by default (an `includeRecent` flag exists but is off).
- `draftMarketing({ goal: string (10–400 chars), locale })`: provider returns 3 variants `{ text }`; each is validated: ≤ 300 characters; contains `{name}` at most once; every number, percentage and currency amount in it must appear in the owner's `goal` text (so the AI cannot invent a discount); no URLs except `APP_URL`; must end with the opt-out line "Reply STOP to opt out" (added by code when missing, in the chosen language). Failures return an error message, never an unvalidated draft.
- `buildWaLink(phone, text)`: `https://wa.me/<digits>?text=<encodeURIComponent(text)>` with `{name}` replaced by the customer's first name or "there"/"जी" fallback; digits only, no `+`.
- Campaign flow: owner writes the goal → picks a draft → edits the text → picks the segment → **Create campaign** (stores body and segment) → the campaign page lists each recipient with a **Send from my phone** link and a **Mark sent** button (records `CampaignSend`); progress "12 of 40 sent". 100 recipients per page.
- Hard rules (tests): **no code path sends marketing through the WhatsApp provider** (`MessageKind` has no marketing kind; a test greps `src/lib/marketing` and `src/app/admin/marketing` for imports of `notify`, `getWhatsApp` and fails if found); opted-out and never-asked customers never appear in any segment or campaign page; after a STOP arrives for a recipient, they disappear from open campaigns' lists on the next load.

- [ ] **Step 1: Write failing tests.** Segments: with 6 customers (granted, revoked, STOP-ed, never asked, granted but recent campaign, granted and inactive) each segment returns exactly the right set; `links.test.ts` encoding of Hindi and emoji text, name replacement, missing-name fallback; `marketing.test.ts` (fake provider) draft containing "20% off" when the goal has no "20" → rejected; a draft with a URL other than the app's → rejected; valid draft gets the opt-out line; campaign integration: create, list, mark sent idempotently, recipient who sends STOP afterwards disappears; owner-only access (STAFF/anonymous rejected); the grep test for no provider imports; e2e: owner drafts, edits, creates a campaign, sees only consented customers, opens a link (assert the href format) and marks one sent; Hindi 360 px; axe clean.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: UI pass:** `$impeccable shape` → build → `audit` + `harden` for the marketing screens.
- [ ] **Step 6: Commit** `feat: AI marketing drafts with consent-safe wa.me links`, then PROGRESS.

---

## Phase 5 gate (after Task 43, before Phase 6)

- [ ] **Exit scenario E2E** `tests/e2e/phase-5-exit.spec.ts`: a verified customer earns points on one bill and redeems on the next (balance correct); cancelling that bill restores the balance; a customer sends STOP and vanishes from the marketing list; the weekly report is queued once; the feedback link works and shows the Google link at rating 1.
- [ ] **Authorization matrix** includes every new action and route (customers, loyalty, feedback public/admin, dashboard, marketing, weekly report cron).
- [ ] **Privacy and security review** `docs/security/phase-5-review.md`: consent latest-wins and append-only; the single audience function; STOP honoured everywhere; erasure completeness (list every table holding a phone number or name and show each is handled); no PII in audit data or logs; AI prompts contain no phone numbers; feedback token entropy and expiry; marketing never uses the WhatsApp provider; ledger invariants and partial unique indexes. Fix failures with tests first.
- [ ] Full lint, typecheck, unit, integration, e2e. Concurrency tests three times.
- [ ] `docs/HUMAN-TODO.md` updated: confirm consent wording with the restaurant; decide retention of bill data with the accountant; try the marketing flow on a real phone with a test list of 3 friends.
- [ ] Write the **Phase 5 summary** in `docs/PROGRESS.md`.
