# Production-readiness repair plan — RestroSathi

Date: 2026-10-07  
Baseline: `79e4723`, branch `phase-6-infrastructure`  
Status: **Planned; implementation has not started. All checkboxes are intentionally open.**  
Purpose: finish the existing single-restaurant scope, repair the audit findings, and obtain verifiable production readiness.

## 1. Authority and outcome

This is a supplementary repair schedule for the existing Tasks 1–47, not a replacement specification or a new product roadmap. The [audit](../../audits/2026-10-07-plan-audit.md), [spec](../specs/2026-09-29-restrosathi-prototype-design.md), [main plan](2026-10-01-restrosathi-implementation-plan.md), [conventions](2026-10-02-conventions.md), and detailed [Phase 2](2026-10-02-phase-2-qr-ordering-plan.md), [Phase 3](2026-10-02-phase-3-billing-plan.md), [Phase 4](2026-10-02-phase-4-whatsapp-bookings-plan.md), [Phase 5](2026-10-02-phase-5-growth-plan.md), [Phase 6](2026-10-02-phase-6-golive-plan.md) plans are the inputs. PRODUCT.md, DESIGN.md and theme.css retain their existing authority.

Every original behavior, acceptance test and gate remains required, including clauses not repeated here. Repair IDs R00–R29 organize corrections to original tasks; they do not authorize new product features. Keep the original plans unchanged except ticking a genuinely finished step. Do not rewrite the historical queue or erase earlier progress claims; append a correction that points to this schedule.

**Complete means all of the following:**

- Correct, usable public website/menu, QR ordering, staff board, takeaway, billing/printing, bookings/events, customer/loyalty/feedback, dashboard/report/marketing and account/system screens.
- Deterministic local tests with fake AI/WhatsApp and Floci; all prescribed suites, concurrency cases, performance budgets and phase gates pass.
- A real production image, authenticated scheduled workers, additive migrations, measurable load results and a demonstrated backup/restore of database **and files**.
- Accurate deployment instructions and secret names; all code-level audit findings closed with evidence.
- Human production checks H01–H08 completed before public launch/pilot sign-off.

Local green checks alone establish **software readiness**, not completion of real-bucket, VPS, WhatsApp, printer/device or restaurant sign-off.

## 2. Execution rules

1. Read the current code and all callers before each change. Write a regression test which fails for the actual defect; run it and retain the output. Implement the smallest shared correction, then run focused tests and the original task's verification commands.
2. Use Node 22, npm, PostgreSQL 17 and the repository's fixed Playwright environment. Use WSL2/Docker for Linux commands; do not weaken commands to fit Windows. Do not install machine-wide packages.
3. No live external services in automated tests. Explicit fake settings must override any ambient API key. Isolate test credentials, database, ports, uploads and outbox files.
4. Preserve validation, role checks, logging, transaction boundaries, locking, accessibility and business rules. Do not use `any`, `@ts-ignore`, test exclusions, blanket catches or assertion reductions to make a gate pass.
5. One focused repair commit when its required checks pass; run Ponytail review first. Never commit a new failing/skipped/weakened test. The inherited red baseline is not evidence of completion: record unresolved failures explicitly, and keep repairing rather than declaring a global gate passed.
6. Reuse the existing phase branches for repairs belonging to those phases when they safely contain the current baseline; otherwise propose/create a recovery branch from the audited HEAD using the `codex/` prefix, without resetting/rebasing older work. Keep one repair branch per affected phase and carry completed work forward. Never merge to main, delete branches, force-push or overwrite the pre-audit history. Branch setup happens during execution, not during this planning request.
7. Preserve the uncommitted audit artifacts. Do not discard a user's unrelated working-tree changes. Record a baseline commit/working-tree inventory before beginning implementation.
8. Progress is append-only. Use `## Task N: <original title> — repair Rxx` entries with commit, exact commands/results, **Deviations**, **Decisions for Hariom** and remaining human items. Multi-task repairs list all original task numbers. Append fresh `## Phase N summary` entries only after re-running that phase's gate; label them as the superseding repair verification.
9. Each task below includes a completion checkbox. Do not tick it for a placeholder, conceptual run, unavailable prerequisite or unreviewed test output. Expected red diagnostics belong in audit evidence, never in acceptance-pass counts.
10. Apply Impeccable only to UI surfaces as specified by AGENTS.md: shape/build/audit/harden, with customer-page critique/polish where required. Use Ponytail full, never ultra. Reuse existing helpers and dependencies; no framework rewrite, additional service layer or object-storage migration for menu uploads.
11. No destructive operations on development/production databases. Test setup must validate the actual parsed database name before resetting the dedicated test DB. Load and restore work use explicitly disposable test databases. Production migration/rollback procedures never use migrate reset/db push.
12. When implementing continuously, follow AGENTS.md's no-stop/human-step protocol. Parking does not make a task or dependent release gate pass. There is no production release while a required task is parked.

**Default design decisions for this repair:** preserve the current single Next.js app and existing OpenRouter adapter as the live AI path; make fake/openrouter selection explicit and route every AI feature through it. The earlier recorded provider switch is not silently reversed. Remove direct Google SDK paths only after equivalent planned behavior works through the shared provider. Confirm the configured live model with the real evaluation before launch. These defaults are documented decisions, not new service purchases.

## 3. Milestones and dependency order

| Milestone | Repair units | Exit |
|---|---|---|
| M0: trustworthy build and runner | R00–R03 | Compiles/builds on Node 22; tests collect against isolated data; dependency findings triaged. |
| M1: ordering and money | R04–R08 | Correct browser boundaries, menu AI, locked billing and actual dine-in/takeaway cycles. |
| M2: communications and bookings | R09–R12 | Fake-delivered OTP/messages; atomic booking capacity and outage-safe flows. |
| M3: complete customer/growth scope | R13–R19 | Consent/erasure, loyalty, feedback, dashboard, safe AI, weekly report and campaigns satisfy their contracts. |
| M4: operations | R20–R26 | Verified encrypted restore, monitoring/accounts/preflight, real Compose and measured load test. |
| M5: release candidate | R27–R29 | Every original phase gate passes; current evidence and handover are complete. |
| Real deployment | H01–H08 | Real services, staging checks, restore, devices and pilot signed off. |

Execute in listed order. This deliberately places mechanical compile/test prerequisites first; feature repairs otherwise follow original phase order. Original Task 38's calculation defect is addressed alongside billing in R07, then its full end-to-end contract closes in R14. Cron authentication is closed early in R04; operational scheduling is finalized after all handlers exist in R25.

## 4. Detailed repair units

### R00 — Preserve evidence and establish the repair baseline
Original scope: all phase gates and progress records. Audit: F18, F24. Dependencies: none.

**Files:** existing audit/evidence; new repair evidence under `docs/audits/production-readiness/`; append-only PROGRESS/HUMAN-TODO.

- [ ] Record HEAD, branch, working tree, Node/npm/Postgres/browser image versions and migration status without printing secrets.
- [ ] Preserve the 2026-10-07 audit as a historical snapshot; record that its nine probes assert defects and must not count as passing features.
- [ ] Append a correction identifying build/test failures, placeholder scenarios and the unmeasured simulated load result. Do not alter the historical figures into apparent real measurements.
- [ ] Inventory every original task's required tests/files and track absent vs placeholder vs substantive coverage. Start an audit-finding closure table with F01–F25 plus the public loyalty-read/erasure gap.
- [ ] Document the NUL-corrupted progress/human passages in a readable appended reconstruction, preserving the original bytes/history. Point execution to this repair schedule rather than relying on malformed queue rows.

**Acceptance/evidence:** baseline can be reproduced from the recorded revision; no old claim is mistaken for current verification. This documentation unit makes no implementation-complete claim.

### R01 — Repair TypeScript/API/schema mismatches and lint failures
Original Tasks 1, 37–40, 44, 46, 47. Audit: F01. Depends: R00.

**Files:** current typecheck-error files, `src/lib/auth/accounts.ts`, billing/table actions, customer/dashboard pages, backup/load/preflight scripts, affected test fixtures; existing schema and helper definitions.

- [ ] Reproduce each error under Node 22. Group by root API/schema mismatch rather than adding casts at every caller.
- [ ] Use existing hashSecret/verifySecret and audit() contracts; query bills/bookings by the actual phone/data relationships instead of inventing Prisma relations solely to compile. Use DiningSession and RestaurantTable.label correctly.
- [ ] Fix OTP signatures/return handling with normalized identity, valid fixture types, imports, null checks and enum values. Add focused tests for behavior changed by those fixes.
- [ ] Fix all lint errors at source. Review the 98 baseline warnings; remove unused code/imports and address effect/dependency/purity warnings with behavioral risk. Do not blanket-disable rules.
- [ ] Run Prisma generation, lint, typecheck and production build. Subsequent units complete missing features; compile fixes must not pretend those features are accepted.

**Commands:** `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, plus focused changed-module tests.  
**Acceptance:** zero TypeScript errors, zero lint errors, successful production build; no suppressions/test exclusions/schema shortcuts. Save actual outputs.

### R02 — Make the test environment isolated, collectible and honest
Original Tasks 1, 10 and all test/gate contracts. Audit: F18, F01. Depends: R01.

**Files:** `playwright.config.ts`, `vitest.config.ts`, `tests/setup/db.ts`, `tests/helpers/{auth,db}.ts`, affected E2E imports, `src/lib/ai/index.ts`, fake providers, CI.

- [ ] Fix browser specs importing server-only auth/actions into Playwright's runner. Drive production behavior via browser/HTTP; use the guarded DB helper only for fixtures. Resolve the nonexistent loyalty helpers import using established helpers.
- [ ] Expand resetOperationalData for Feedback, LoyaltyTxn/reversals, Payment, BillLine/Bill and all later operational tables in FK-safe order. Preserve settings/users/menu/tables deliberately; reset changed settings/fake controls between specs.
- [ ] Keep real migrations in setup, including hand-written partial indexes/CHECK constraints. Test rejection of non-test URLs before reset.
- [ ] Run Playwright against `npm run build && npm run start`, on a dedicated test port, without reusing an unrelated running server. Use explicit test database and uploads/outbox locations.
- [ ] Make `AI_PROVIDER=fake` take precedence even with an API key and NODE_ENV=production; fake WhatsApp still requires ALLOW_FAKE_WA=1. Prove fake-mode tests make no outbound provider calls.
- [ ] Fix retention boundary tests with an injected/frozen clock. Make Docker/pg_dump prerequisites explicit; absence may not silently return a “passed restore.”
- [ ] Enumerate every placeholder, empty test, skipped viewport and swallowed-error assertion; replace them in their owning units below. Until replaced, report affected acceptance scenarios as missing, not satisfied.

**Commands:** `npm run test:e2e -- --list`; `npm run test:unit`; focused fixture/auth checks; one production-build smoke spec in both Playwright projects.  
**Acceptance:** actual specs collect; no next/headers/helpers errors; fixtures reliably reset twice; fakes remain deterministic in production mode; no accidental dev/live database or service use.

### R03 — Resolve dependency security findings with compatible changes
Original Phase 6 security gate. Audit: F25. Depends: R01–R02.

**Files:** `package.json`, lockfile, related config/tests, phase security review.

- [ ] Re-run `npm audit --omit=dev --json`; distinguish advisory roots from repeated transitive affected-package counts.
- [ ] Review official fixed-version information and actual runtime/build reachability for deepmerge-ts/Prisma and next-intl findings. Prefer the smallest compatible update; keep Prisma client/CLI aligned.
- [ ] Do not run a blind forced major upgrade. Record each resolution or justified non-applicability with evidence and a review owner/date.
- [ ] Regenerate client and run impacted auth/i18n/DB tests, lint/typecheck/build. Repeat the audit after R17/R19 remove unused SDK paths.

**Acceptance:** no unreviewed high/critical findings; every remaining advisory has concrete triage. No dependency added merely to avoid a small repair.

### R04 — Close route authentication, origin and body-size gaps
Original Tasks 13, 19, 28–36, 45–46; security gates. Audit: F05, F19. Depends: R02.

**Files:** `src/lib/cron.ts`, public order route, all cron/webhook routes, authz matrix and route tests.

- [ ] Write failing unauthenticated/wrong-secret/missing-secret/Unicode-token tests for every cron endpoint; correct callers must pass. Compare token bytes safely and fail closed when configuration is absent.
- [ ] Reuse verifyCronSecret; convert state-changing cron endpoints to POST and reject GET. Protect alerts immediately; implement its full behavior in R22.
- [ ] Replace origin substring matching with parsed exact expected origin/host/port comparison. Test a real valid attacker subdomain, wrong port/scheme, absent/malformed origin and missing/untrusted forwarding headers.
- [ ] Read public JSON bodies with a streaming 100 KB cap, including absent/spoofed Content-Length and multibyte input. Return stable 400/413 errors; never call business logic for rejected bodies.
- [ ] Preserve the shared placeOrder code path/device/IP limits for route and action. Test route-path code vs body-code tampering and board anonymous rejection/no-store response.
- [ ] Update the authorization matrix to exercise real successful permitted operations, exact denials and explicitly public exceptions; remove “any exception counts as pass.”

**Acceptance:** nine-probe origin/alerts/body regressions have conventional tests asserting rejection; anonymous/wrong-role/secret cases cannot mutate data or leak health details.

### R05 — Repair grounded menu AI and explicit provider behavior
Original Task 18. Audit: F21 and provider-selection part of F12. Depends: R02–R04.

**Files:** `src/lib/ai/{index,provider,fake,openrouter,assistant,usage,allergy}.ts`, eval cases/script, AskMenu, messages.

- [ ] Derive base/variant prices from the established menu rules, sort variants consistently, and omit sold-out entries. Never treat a base-priced item as free.
- [ ] Make the fake derive valid item IDs from supplied context, including vegetarian requests, rather than returning a fixed E2E fixture ID.
- [ ] Enforce explicit supported provider selection, bounded response/token/time behavior and safe fallback on missing keys/provider failure; use the existing adapter interface.
- [ ] Re-run allergy no-call, 20/device/day, monthly cap race (10 calls with cap 5), once-only 80% audit, unknown/sold-out ID and prompt-injection cases.
- [ ] Run fake English/Hindi/Hinglish eval and AskMenu E2E; keep real-provider evaluation as H04.

**Commands:** focused `src/lib/ai` unit/integration tests; `npm run eval:ai` with explicit fake; `npm run test:e2e -- ask-menu.spec.ts`.  
**Acceptance:** all returned prices equal DB prices; no AI failure breaks ordering; no provider call for allergy/cap refusal.

### R06 — Serialize all bill mutations with orders and settlement
Original Tasks 12–14, 22–24, 38. Audit: F02. Depends: R04.

**Files:** sessions/order mutations, `src/lib/billing/{generate,settle,cancel}.ts`, loyalty draft mutations and integration tests.

- [ ] Add controlled concurrency regressions: generate vs place/void, regenerate vs settle, apply/remove redemption vs settle, two generators and two settlers. Coordinate overlap using barriers/locks, not arbitrary sleeps.
- [ ] Acquire the documented table/session advisory lock, then bill row, then customer row, then invoice counter as applicable. Re-read mutable state after locks.
- [ ] Make helpers use the caller's transaction client; do not open global-client reads/writes within the locked operation when they belong to that transaction.
- [ ] Prohibit changing settled/cancelled snapshots/lines/totals; ensure stale accepted/rejected/order-line changes cannot be hidden by a late generatedAt timestamp.
- [ ] Keep invoice allocation/payment/close-session/audit atomic. Re-check lock order in cancellation, loyalty adjustment and related code for inversion.

**Commands:** focused billing/orders/loyalty integration files, authz matrix. Repeat the prescribed races three times.  
**Acceptance:** no missing/duplicate billed lines, no post-settlement amount change, no deadlock/pool timeout and one immutable invoice per settlement.

### R07 — Preserve loyalty discounts across bill edits and reconciliation
Original Tasks 21–27, 38. Audit: F03. Depends: R06.

**Files:** billing calculation/generation, loyalty draft functions, settlement, print/customer/day-end readers.

- [ ] Convert the audit example to a regression: 20,000 subtotal − 5,000 loyalty = 15,000 paise after regeneration, with exactly 100 redeemed points at settlement.
- [ ] Use one internal draft recalculation path for applying/removing redemption and regeneration; preserve manual discounts, tax snapshot rules, integer rounding and reason/role validation.
- [ ] Changing phone clears verification and its redemption; explicitly handle loyalty settings changing while a draft is open. Never grant a discount without the matching debit or debit without its discount.
- [ ] Reject non-integer/nonpositive/non-unit points, insufficient balance and excessive combined discounts; revalidate within the transaction at settlement.
- [ ] Show loyalty breakdown in staff, customer and 80 mm views and prove day-end/payment totals reconcile to the paisa.

**Acceptance:** generated/settled/printed/customer totals agree; regeneration is stable; disabled/changed-customer paths are deterministic and tested.

### R08 — Re-prove foundation, menu, ordering and billing journeys
Original Tasks 1–27 and Gates 0–3. Audit: F18 and earlier unverified task coverage. Depends: R01–R07.

**Files:** existing E2E specs/fixtures, menu/uploads/auth, board/KOT/bill/print/day-end modules if failures identify defects.

- [ ] Restore the complete order-cycle scenario: two devices share one session, duplicate submission creates one order, server prices win, sold-out is live, each staff status appears within five seconds.
- [ ] Exercise staff takeaway and dine-in → request bill → generate → discount → split Cash/UPI/Card → settle → print → table free on mobile and desktop. Remove the mobile billing skip by fixing the surface.
- [ ] Restore **20** concurrent different-bill settlements yielding 0001–0020, plus same-bill one-winner behavior; run three loops. Include FY rollover, cancellation/reversal, print snapshots and IST day-end reconciliation.
- [ ] Verify authentication/lockout/session expiry, table-code regeneration, menu-structure rejection, content-sniffed uploads/path traversal, English fallback, overnight settings and customer bill access boundaries.
- [ ] Keep current failure evidence for any later-feature dependency; do not certify Gates 0–3 until their entire required commands pass. Fix causes within the original scope.

**Acceptance:** substantive core journeys pass in both projects, no skips; all original Tasks 1–27 criteria have concrete test/manual evidence. Provider outages do not affect ordering/billing.

### R09 — Repair every notification contract and outbox transaction boundary
Original Tasks 28–29, 31–35, 39, 42, 45. Audit: F04, F06. Depends: R04.

**Files:** whatsapp notify/outbox/provider/webhook, message templates, all notify callers, current cron Compose entries.

- [ ] Inventory each MessageKind, producer parameters and both locale placeholders. Prefer a small typed per-kind parameter map over an untyped catch-all.
- [ ] Align OTP, booking receipt/confirmation/reminder/cancel, event acknowledgement, auto-reply, escalation, feedback, weekly and system-alert payloads. Build links from APP_URL and display dates/times in IST.
- [ ] Queue each business event in its own DB transaction via `{tx}`; send only after commit. Use the returned message ID, never “latest message globally.”
- [ ] Exercise real producer → real render → fake provider paths in both languages. Preserve five-retry/backoff, OTP scrubbing, provider dedupe, concurrent worker claims and disconnected banner behavior.
- [ ] Correct outbox cron to POST immediately and prove a local fake message drains. Final scheduling/package checks remain R25.

**Acceptance:** no missing-template parameters; messages reference the right booking/bill; a failed provider leaves durable pending work and never rolls back a successful order/bill/booking.

### R10 — Make OTP issuance, verification and identity binding atomic
Original Tasks 30, 37–38. Audit: F07 and public loyalty-read gap. Depends: R06, R09.

**Files:** otp, verified cookie, phone/rate-limit helpers, booking/table/billing actions and OtpField/JoinRewards tests.

- [ ] Reuse normalizePhone; equivalent Indian formats identify one phone, invalid/international input follows the original contract.
- [ ] Enforce three sends/phone/hour and twenty/IP/hour through the shared durable rate-limit mechanism, atomically. No process-local counters.
- [ ] Serialize attempts/consumption with conditional update/row locking; correct code succeeds once, five wrong attempts consume it, expiry and replacement reject old codes. Never log/raw-store OTP beyond the required scrubbed outbox lifecycle.
- [ ] Preserve the public `verifyOtp` contract where possible: normalize in the action and use that verified canonical phone, rather than inventing a phone property on `{ok:true}`. Provide the required context.
- [ ] Bind table phone/balance to the verified device and active session; remove arbitrary-phone balance lookup. Billing must match the bill's current phone under its lock before setting verifiedAt.
- [ ] Test signed cookie tampering/expiry, enumeration-resistant responses, concurrent issuance/attempts/consumption, cross-phone and cross-table balance access.

**Acceptance:** delivered fake OTP works through actual forms; no double use, lost attempt counts or unauthenticated balance disclosure; changing phone invalidates its verification.

### R11 — Fix booking time arithmetic, duplication and capacity races
Original Tasks 31–32. Audit: F08, F09. Depends: R09–R10.

**Files:** bookings slots/request/confirm/status/reminders/cancel, actions/forms, blocked dates and related tests.

- [ ] Use explicit IST calendar conversion and UTC instants, never host-local getDay/setHours. Test UTC and Asia/Kolkata hosts against identical expected instants, weekdays, cutoff, sixty-day horizon and overnight shifts.
- [ ] Move request device/phone limits to shared durable rate limiting; serialize same-phone/same-slot active-request creation so concurrent requests cannot duplicate.
- [ ] Retain per-IST-date advisory locking from Task 32, extending it for overnight overlap: lock the booking's start date and prior date in sorted order (90-minute occupancy cannot span more than these relevant starts), then re-read REQUESTED. Query every booking overlapping its occupied slots, including prior-date starts. Prove the chosen lock set serializes next-date overlapping requests without a global restaurant lock.
- [ ] Re-check transition/status/time after locks for confirm/decline/cancel/arrive/no-show. Keep capacity calculation and notification/audit writes atomic.
- [ ] Queue reminders once, only for confirmed future bookings made at least three hours ahead; run concurrent workers. Public cancellation is token-bound POST with invalid/expired handling.
- [ ] Restore complete staff booking UI: date grouping, status/actions, covers remaining, blocked dates owner-only, ten-second refresh, bilingual validation.

**Acceptance:** capacity-10 concurrent parties-of-three → exactly three successes in three loops; previous-day 23:30 blocks next-day overlapping slots; exact-fit succeeds; duplicate confirmations/messages cannot occur.

### R12 — Complete events, auto-reply, escalation and retention acceptance
Original Tasks 28, 33–36 and Gate 4. Audit: F04/F18/F24. Depends: R05, R09–R11.

**Files:** event packages/enquiries, ai facts/autoreply, messages inbox, orders escalation, retention/privacy and E2E.

- [ ] Walk Task 33's package/enquiry validation, owner/staff transitions, public rate limits and bilingual event pages against its full original contract.
- [ ] Auto-reply must use only settings/current-menu facts, allergy no-call, monthly/daily cap, 12-hour human pause, STOP suppression, reply length/price/link/booking-claim validation and never-throw handover.
- [ ] Prove webhook auth, group/broadcast ignore, ID dedupe and human-reply pause using fake inbound requests; render user content as text.
- [ ] Escalations claim NEW orders transactionally, aggregate one message and dedupe concurrent cron calls; no owner phone stamps nothing.
- [ ] Retention deletes only explicitly allowed records at original ages and ErrorLog >30 days; preserve bills/payments/orders/bookings/audit. Preserve the meaning of both-language privacy copy.
- [ ] Restore Gate 4's actual booking/STOP/webhook/provider-outage E2E and write fresh security evidence.

**Acceptance:** original Tasks 28–36 acceptance succeeds locally with fakes. Pairing/privacy review remain human steps, not reasons to omit local tests.

### R13 — Complete customer records, consent and erasure
Original Task 37; later model extensions. Audit: F10, F13, privacy inventory gap. Depends: R10–R12.

**Files:** customers index/consent/erase, bill settlement/generation/actions, booking request, STOP handler, customer pages/actions, schema/migration only when required.

- [ ] Pass transaction clients through upsert/consent helpers. Test consent for newly inserted and existing customers, explicit false, rollback and concurrent append.
- [ ] Read the saved billing marketing checkbox in settlement; false must be able to clear an earlier draft choice. Never turn an unchecked box into consent.
- [ ] Use the canonical audience function for every recipient read; latest grant plus valid phone plus no OptOut. Backfill preexisting OptOut into denied consent idempotently.
- [ ] Implement valid customer list/detail queries, visits/last visit, birthday/anniversary fields with purpose, consent history, owner-only consent edits/erasure.
- [ ] Extend erasure and HANDLED_MODELS tests for LoyaltyTxn and Feedback now and CampaignSend in R19. Test every actual PII-bearing model, preserving bill totals/numbers/payments and blocking OptOut entries.
- [ ] Ensure erasure audit contains only identifiers, not erased PII. Show a clear confirmation/result without exposing errors.

**Acceptance:** billing/booking consent survives exactly when the transaction commits; STOP always excludes marketing; erasure test walks Prisma DMMF and verifies before/after data.

### R14 — Finish the loyalty ledger and customer rewards flow
Original Task 38. Audit: F02/F03/F07/F18 and privacy gap. Depends: R07, R10, R13.

**Files:** loyalty ledger/constraints, settle/cancel, settings, JoinRewards, bill controls, print/customer view/day-end, tests.

- [ ] Verify partial unique EARN/REDEEM indexes, reversal uniqueness and nonzero points CHECK survive every migration.
- [ ] Use transaction-scoped balance reads under customer locks. Concurrent 100-point redemptions with balance 100 yield one settlement and one balance-changed failure with no invoice consumed.
- [ ] Exercise earn, redeem, adjust with required note/owner role, cancel and repeated reversal. Allow a negative balance only in the documented spent-earned-points cancellation case.
- [ ] Implement the exact seeded property test: 300 random sequences for five customers, comparing both ledger sum and independent expected counter after each operation.
- [ ] Finish JoinRewards/phone/balance/redeem/settings controls and actual customer → staff → next bill E2E; include Hindi/360 px, print breakdown and day-end reconciliation.

**Acceptance:** every Task 38 invariant holds; unverified phones/off loyalty earn nothing; no double debit or mutable settled redemption.

### R15 — Replace feedback placeholders with complete functional coverage
Original Task 39. Audit: F18 and erasure extension. Depends: R09, R13–R14.

**Files:** feedback submit/action/pages/form/admin, settlement/print, actual integration/E2E tests, messages.

- [ ] In settlement's transaction create one seven-day token and queue one thank-you only for that bill's verified phone. No provider call inside the transaction.
- [ ] Validate 1–5 integer ratings/comment <=500; enforce conditional one-time submission, expiry and IP/token limits including concurrent requests.
- [ ] Unknown/expired/submitted pages reveal no invoice/customer data and still show the Google review link when configured. Show that link before and after every rating, including one star.
- [ ] Test printed QR URL for bills without verified phones and the full scan→submit journey in both viewports/locales.
- [ ] Complete admin recent feedback, table/takeaway context and 7/30-day averages; extend erasure test.

**Acceptance:** real DB/browser assertions replace expect(true); double-submit stores exactly once and review access is never rating-gated.

### R16 — Implement the planned owner dashboard facts
Original Task 40. Audit: F14. Depends: R11, R13–R15.

**Files:** `src/lib/dashboard/`, admin page/Dashboard component, tests/messages.

- [ ] Build owner-only facts over IST settlement windows, not generation times; cancelled bills excluded; average money rounded using the billing integer helper.
- [ ] Add today sales/count/average/open sessions, today/7-day top dishes, 24 busy-hour buckets over fourteen days, today/tomorrow/next-five bookings, needs-human count, AI warning and WhatsApp state.
- [ ] Use existing Prisma models and UTC boundaries; cover midnight, month change, empty data and long names.
- [ ] Render simple CSS/SVG bars with equivalent accessible table. Staff gets the planned board shortcuts rather than owner financial data.

**Acceptance:** fixture-calculated values match to the paisa; no nonexistent relation/query, invalid-date parse or fractional-paisee formatter crash; owner/staff separation and dashboard E2E pass.

### R17 — Implement safe feedback themes and reply drafts
Original Task 41. Audit: F12. Depends: R05, R15–R16.

**Files:** ai feedback, reports weeks, FeedbackSummary migration, feedback UI/actions, tests.

- [ ] Use the existing provider and shared atomic monthly cap. Strip phone-length digit sequences, email addresses and handles before sending data.
- [ ] Fewer than five comments → statistics only, zero AI calls. Bound selection to 100 comments; validate structured themes/indexes, drop invalid/duplicate references and calculate counts in code.
- [ ] Persist by IST week start and display source count/AI label/examples. Provider error/cap reached produces statistics plus a clear fallback.
- [ ] Owner-only reply draft <=400 chars; validate refunds/free/discount/amount/URL restrictions and use a safe localized fallback. Nothing posts automatically.
- [ ] Remove obsolete direct Google call paths; uninstall their SDK packages only if no remaining legitimate imports after R19.

**Acceptance:** PII never appears in captured fake-provider input; forbidden/unvalidated outputs never reach copy UI; real owner flow and wrong-role tests pass.

### R18 — Implement an idempotent Monday owner report
Original Task 42. Audit: F20/F06. Depends: R16–R17.

**Files:** reports weeks/weekly, WeeklyReportLog/ownerLocale migration/settings, cron route, owner weekly page/tests/messages.

- [ ] Compute previous Monday–Sunday IST window, with explicit Monday 08:59/09:00, Sunday and month/year boundary tests.
- [ ] Calculate all original facts in code: sales/count/average/best day/hour/top dishes, confirmed/no-show bookings, rating/count, cancellations and voids.
- [ ] Render both languages using formatINR. Optional <=200-character insight must use only fact numbers, no URLs/promises; AI failure still sends the facts.
- [ ] Monday after 09:00 and no existing week log: atomically insert log and queue the report. Five concurrent calls queue once; no phone queues nothing.
- [ ] Add owner view/force test send, which does not consume the scheduled week's log. Configure hourly invocation in R25.

**Acceptance:** exactly once per week, correct settlement window/facts and localized owner text; staff/anonymous cannot force-send.

### R19 — Complete consent-safe marketing campaigns
Original Task 43. Audit: F12/F13. Depends: R13, R17–R18.

**Files:** marketing segments/links/campaigns, ai marketing, Campaign/CampaignSend migrations, marketing pages/actions, customer recipient UI, erasure/tests/messages.

- [ ] Every segment begins with getMarketingAudience and only narrows: all consented, visited30, inactive60, birthdays-this-month; exclude any campaign in prior seven days by default.
- [ ] Owner provides goal 10–400 chars and locale. Shared quota/provider returns three validated variants <=300 chars; amounts/numbers must exist in goal, APP_URL-only links, at most one name placeholder and enforced localized STOP line.
- [ ] Build goal→draft→edit→segment→create→recipient list (100/page)→wa.me→mark-sent flow. Validate edited text at persistence too, not only generated drafts.
- [ ] Mark sent is idempotent. Recompute audience on every campaign read; STOP after creation removes the recipient. Never send marketing via notify/provider.
- [ ] Extend erasure for CampaignSend; encode Hindi/emoji/name fallbacks; remove unsafe promo links from the generic customer list.
- [ ] Remove unused direct-provider dependencies and rerun audit.

**Acceptance:** all original Task 43 tests, owner E2E and no-provider-import check pass; STOP never re-enters a campaign through later consent or saved recipients.

### R20 — Authenticate the complete streaming backup format
Original Task 44. Audit: F22. Depends: R03.

**Files:** backup crypto and its tests; backup-format documentation.

- [ ] Preserve 1 MiB streaming AES-256-GCM; use a per-file random identifier/nonce base with collision-safe chunk nonces and authenticated header/version/index/length/final marker.
- [ ] Version the repaired format. Inspect whether any real old archives exist before deciding compatibility; do not silently invalidate the only backup. Old format, if retained for recovery, must be explicitly labelled as legacy without a verified-integrity claim.
- [ ] Add reorder, cross-file splice, duplicate frame, early-final-marker, truncation and appended-data rejection tests in addition to wrong key/bit flip.
- [ ] Round-trip 0,1,1MiB−1,1MiB and a 50MiB stream by hashes. Stage decrypted output privately; never leave partial plaintext in the requested destination on failure.
- [ ] Keep S3/hash sidecar as accidental-corruption detection, not a replacement for keyed file integrity.

**Acceptance:** reordered audit sample is rejected; streaming size tests pass; no sensitive bytes/keys in logs. No new encryption dependency.

### R21 — Complete backup upload, restore and verified recovery
Original Task 44. Audit: F11/F18. Depends: R20.

**Files:** backup run/restore/s3/retention, backup image/Compose, tests, RESTORE.md.

- [ ] Fix ESM entry detection and CLI exit handling. Missing arguments fail with usage, failed upload/retention records failure and exits nonzero, child-process errors/exit events cannot hang.
- [ ] Use a compatible PostgreSQL 17 client in the backup container and prove the Prisma/tsx runtime is generated and available there.
- [ ] Archive app dump, uploads and recoverable WA-AKG session state. Inspect the actual adapter deployment: a raw copy of a running PostgreSQL data directory is not a logical backup; use a consistent WA database dump/session export or a documented quiesced snapshot.
- [ ] Restore into explicit scratch DB/files directory; verify ciphertext hash and authenticated stream **before** DB restore/installation. Reject traversal/unsafe archive paths; resolve target paths before writing.
- [ ] Compare parsed source/target DB identities, not URL string equality alone; retain explicit dangerous-overwrite flag, which tests must never use against a real source.
- [ ] Restore uploads/session files into --files-dir with checksum comparison. Compare Settings/User/MenuItem/Bill/Booking counts and representative row values; verify source unchanged.
- [ ] Prove wrong key, tampered hash/object, unavailable bucket, retention listing failure and 35-day boundary behavior. Always keep newest backup.
- [ ] Run the full Floci drill with pg_dump/pg_restore inside Docker. Missing tools cannot make this test pass. Write exact fresh-host restore steps and key-loss/recovery responsibilities.

**Acceptance:** complete Floci DB+files round-trip, nonzero failures, no source mutation, no partial destination and recorded elapsed restore time/bytes. Real bucket/VPS drill remains H05.

### R22 — Implement authenticated monitoring and transactional alerts
Original Task 45. Audit: F05/F06. Depends: R04, R09, R21.

**Files:** errors/instrumentation, monitoring checks/alerts, cron alerts, health/deep, system page/tests, MONITORING.md.

- [ ] Verify all seven checks against injected facts: DB, disk>85%, backup>26h, failed/stuck outbox, disconnected WA>30m, AI>=80%/exhaustion, errors>=20/10m.
- [ ] Make each alert key independent: first failure, no repeat inside six hours, repeat after six, one recovery. Serialize concurrent evaluations and queue SYSTEM_ALERT via notify; no direct provider calls.
- [ ] No owner phone must not crash or suppress system-page visibility. Preserve failure state carefully so adding a phone later can notify.
- [ ] Add protected GET deep-health with the common secret guard; public health stays minimal, returning503 on DB failure without stack/version/secrets.
- [ ] Scrub phone/email/body/stack details in errors, bound length and retain30 days. Display owner-only status plus backup size/outbox/WA/AI/last50 errors.
- [ ] Document external uptime monitoring because in-app alerts cannot report a stopped VPS.

**Acceptance:** bad secrets never disclose or mutate; concurrent alert jobs dedupe; system failure/recovery E2E and scrub tests pass.

### R23 — Finish owner/staff account management
Original Task 47. Audit: F16/F18. Depends: R01, R04.

**Files:** auth accounts/password/session, admin staff/account forms/actions, tests/messages.

- [ ] Test real owner-created staff login with4–6digit PIN; active-name uniqueness under concurrency, reset invalidates old PIN, existing lockout remains.
- [ ] Use existing scrypt/audit/session primitives; account mutations and audit/session-revocation writes belong to one transaction where applicable.
- [ ] Deactivation revokes sessions; reactivation follows name uniqueness rules. Password change requires current password and >=10 chars, ends other sessions while preserving current session as specified.
- [ ] Add actual list/add/reset/deactivate/reactivate and password forms with labels, clear errors/pending/success, no secret echoes or audit payloads.
- [ ] Replace empty integration/E2E and generic-throw authz assertions with successful owner actions and precise staff/anonymous denials.

**Acceptance:** actual two-browser owner→new staff journey succeeds; deactivated users/current old credentials fail; no audit row contains PIN/password.

### R24 — Make preflight enforce every production prerequisite
Original Task 47. Audit: F17. Depends: R18, R21–R23.

**Files:** preflight script/checks/tests, settings/menu queries, env examples.

- [ ] Snapshot actual active users, available items, active tables, settings and latest successful backup; verify demo credentials against stored hashes with existing async helper. Pass derived credential-verification results into pure checks.
- [ ] Enforce production, HTTPS URL, non-example32+char secrets,32-byte decoded backup key, nonnull credentials, demo-name rule, valid address/phone/owner phone/hours, confirmed tax and GSTIN validation, no ALLOW_FAKE_WA, real selected WA provider, >=1table, >=5available items and backup<26h.
- [ ] Emit required FSSAI and enabled-AI/fake warnings distinctly; warnings cannot masquerade as mandatory passes. Check required cron configuration.
- [ ] Missing/invalid provider must fail, not just literal “fake.” Validate exact supported configuration against R25's env contract.
- [ ] Exit nonzero for any FAIL **and** unexpected DB/config errors; disconnect cleanly. Test every failure independently plus the audit's previously false-positive snapshot.
- [ ] Run development preflight and record the expected failures; prove a realistic valid synthetic snapshot passes without contacting real services.

**Acceptance:** no demo credential, fake override, invalid contact configuration or stale backup can receive a production PASS.

### R25 — Validate the real production image, migrations and job schedule
Original Tasks 19,29,32,35–36,42,44–45,47. Audit: F06/F24. Depends: R09–R24.

**Files:** Dockerfiles/entrypoint/Caddy/Compose/.dockerignore, env examples, deployment/hand-over docs, smoke checks.

- [ ] Build app and backup images from clean lockfile; run nonroot app with writable uploads, complete standalone dependencies/Prisma CLI and migrate-deploy startup. Do not seed/reset on every boot.
- [ ] Validate blank-install **and** upgrade-from-baseline scratch databases. Preserve invoice/active-session/loyalty constraints; review SQL before migrations; no destructive down migration.
- [ ] Only Caddy exposes public80/443; Postgres/WA stay internal, Floci test-only loopback. Exclude env/secrets/test artifacts from image context/layers; inspect required headers/cookies on the production server.
- [ ] Define one documented authenticated POST schedule: outbox at its planned interval, reminders at Task32 frequency, escalation every minute, alerts every5min, weekly report hourly with internal due guard, retention daily. Use backoff/logged failure; a failed call must not silently look healthy.
- [ ] Backup runs about03:00 IST regardless of container timezone; verify local14-file and offsite35-day retention responsibilities, sizes and health timestamps.
- [ ] Exercise the actual cron container against fake services: queue→send, reminder, escalation, alert, weekly due/no-duplicate and retention. Remove calls to nonexistent routes.
- [ ] Keep the exact env contract below consistent with code, examples, deployment and preflight. Real secrets remain outside the repo.

**Acceptance:** clean Docker image starts, migrations run once safely, restart preserves data/uploads, health returns200, workers reach the correct methods/paths and failures are visible. No deployment to a real server in this unit.

### R26 — Replace the load stub with measured HTTP traffic
Original Task46. Audit: F15/F19. Depends: R04, R08, R14, R25.

**Files:** loadtest runner/stats/tests, thin routes if required, docs/loadtest README and measured result artifacts.

- [ ] Parse DATABASE_URL, reject production and names not ending _load/_test before any mutation. Require an explicitly disposable test target; seed/reuse20tables without broad deletes of unrelated data.
- [ ] Generate three valid43-character base64url auth tokens, store SHA256 in AuthSession and use real cookie headers. Twenty customers each receive independent device cookies/IP addresses.
- [ ] Start the production build itself with explicit fakes; for at least5min place random valid orders every20–40sec with unique keys and deliberate duplicates. Three staff poll every3sec and progress orders through shared library actions.
- [ ] Measure actual order/poll request counts/errors/p50/p95/p99, unique keys vs created orders/duplicates, DB connection peak, pool timeouts and machine CPU/RAM/runtime. Warm-up must be recorded separately, never discard failed measured requests.
- [ ] Write JSON and Markdown from the same measurements, with revision/start/end/config. Preserve the historical simulated result but clearly supersede it.
- [ ] Enforce original thresholds: order p95<1000ms, board p95<500ms, zero5xx, zero lost/duplicated orders, zero Prisma pool timeouts. Fix measured bottlenecks with supported indexing/query changes; rerun and retain before/after.
- [ ] Validate on local hardware now; repeat on an isolated test database on the real VPS size under H06, never against the restaurant's operational database.

**Acceptance:** saved results come from actual5min traffic and pass every threshold; a deliberately failing run exits nonzero.

### R27 — Complete bilingual, accessible and responsive UI verification
Original Tasks3,6–10,15–17,20–27,31–43,45,47. Audit: F23/F18. Depends: all feature units.

**Files:** messages, theme-token usage and every changed surface, existing Impeccable briefs/reviews, browser tests.

- [ ] Inventory all visible hardcoded strings including errors/toasts/empty states/print messages/cron customer text; put both real Hindi and English in messages.
- [ ] Replace raw palette/spacing/radius/motion values with theme tokens. Preserve operational workflow and existing design authority; do not redesign billing rules or auth.
- [ ] For public home/menu/table/book/cancel/events/privacy/feedback and every admin surface, check loading, empty, success, validation, server/provider failure and long-content states.
- [ ] Verify44px targets, visible keyboard focus, dialog focus/escape, semantic labels/status announcements, html lang, text contrast and reduced motion. Pair axe with manual keyboard inspection.
- [ ] Run mobile360px and desktop in both languages, including long Hindi and missing-hi fallback. Require zero page horizontal overflow; inspect screenshots before updating baselines.
- [ ] Measure first-load gzipped JS on the production build for /menu and /t/[code], each<=150KB using the existing gate. Move unnecessary client work out of these routes instead of raising the budget.

**Acceptance:** documented surface matrix passes; no untranslated operational flow; original accessibility/performance thresholds remain unchanged.

### R28 — Run every original gate and close the audit with evidence
Original Gates0–6. Audit: all. Depends: R00–R27.

**Files:** authz matrix, phase security reviews, CI, final evidence and append-only progress.

- [ ] Reconcile every original Task1–47 requirement to a test, artifact or explicit HUMAN item. The audit was not an exhaustive proof of every line: this reconciliation must catch any additional missing clause.
- [ ] Run all commands in section5 in the fixed environment. Re-run money/booking/OTP/loyalty/weekly/outbox concurrency where prescribed; do not stop at the focused suites.
- [ ] Re-run all original phase exit scenarios with real assertions, mobile/desktop and provider outages. No placeholder, empty, skipped-required or swallowed-error tests.
- [ ] Update code-level security reviews with pass/fail/evidence for every phase: role/access matrix, table-scoped bills, request limits, uploads/XSS, webhook/cron, rate limits, secret/client-bundle leakage, cookies/headers/CSP, privacy/redaction/retention, backup integrity and dependency findings.
- [ ] Verify production migration rehearsal, Floci restore and measured load artifacts all match the candidate revision. Repeat affected checks after any final repair.
- [ ] Run Ponytail full audit. Apply only justified reuse/deletion after tests; retain all planned safeguards and fake/provider boundaries.
- [ ] Record F01–F25 plus privacy gap as closed only with an exact test/result/revision reference. Append superseding Phase0–6 summaries; any failed gate keeps software readiness false.

**Acceptance:** CI and all required local gates green on the same candidate commit; no open required-code blockers; human prerequisites remain plainly listed.

### R29 — Publish an accurate handover and production launch packet
Original Task47/final wrap-up. Audit: F24. Depends: R28.

**Files:** README, DEPLOY, RESTORE, MONITORING, HANDOVER, QA-REAL-DEVICE, PILOT-CHECKLIST, FINAL-REQUEST; append HUMAN-TODO/PROGRESS.

- [ ] Write exact tested build/start/migrate/seed-once/backup/restore/preflight commands, which container runs them, and rollback steps matched to the final images.
- [ ] Correct S3/WA/AI names everywhere; remove obsolete instructions by explicitly superseding append-only human/progress entries.
- [ ] Separate software-gate status from human completion. Do not say “all complete” while a required real-bucket/device/restore/pilot check is open.
- [ ] Include candidate revision/image identifiers, measured load and restore results, outstanding warnings, ownership of each secret, expiry/rotation notes and support contacts supplied by the owner.
- [ ] FINAL-REQUEST includes exact keys/access, every recorded decision/default, genuinely parked tasks/failed gates (if any), and three next human actions.
- [ ] Tick original plan/repair boxes only where complete; do not fabricate commit hashes or clean up history to hide prior failure.

**Acceptance:** another operator can follow the launch/restore instructions; configuration names match executable code; all unresolved human work is explicit and ordered.

## 5. Verification commands and evidence rules

Run these from the repository root in the supported Node22/Linux environment, with only disposable test database credentials and fake-provider settings supplied securely. R02 must make the E2E command build/start its isolated production server. Commands below are acceptance gates, not instructions to run against production data.

```bash
node --version
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:int
npm run test:e2e -- --list
npm run test:e2e
npm run eval:ai
npm audit --omit=dev
docker build -t restrosathi:release-candidate .
npm run loadtest
git diff --check
```

Additionally run:
- R21's backup integration within the Docker environment containing PostgreSQL17 tools and Floci; both source and destination are disposable test databases.
- R25's `docker compose -f docker-compose.prod.yml config` and isolated startup/job smoke checks using a generated fictional env file. Do not log resolved real-secret configuration.
- `npm run preflight` in development expecting nonzero with named failures; then a fully valid isolated snapshot/runtime rehearsal. Real-server preflight is H07.
- All focus commands named in the original phase plans; filters use actual file names and must collect nonzero tests. The full suite is mandatory at the final gate.

For every gate save: UTC timestamp, commit, environment versions, exact command, exit status, test counts and untruncated failure details. A missing prerequisite is NOT RUN, a nonzero result is FAILED. Never count an ordinary early return or mocked-out business flow as integration success. Audit probes remain archived evidence; add normal regression tests asserting corrected behavior to the existing suites.

## 6. Release acceptance matrix

| Area | Required proof |
|---|---|
| Public/menu | Hindi/English/fallback, settings/sold-out immediately visible, safe uploads, overnight hours, axe/keyboard/360px, <=150KB. |
| Ordering | Same session across devices, server-priced items/modifiers, idempotent duplicate, rate limits, status visibility<5sec, staff board/KOT. |
| Money | All tax modes/rounding, immutable snapshots,20invoice race, split payments, stale detection, cancellation, exact day-end reconciliation. |
| Customer identity | Delivered fake OTP, atomic limits/consumption, signed-cookie expiry, phone/session binding, no arbitrary balance disclosure. |
| Bookings/events | Correct IST slots, cutoff/blocks, overnight/concurrent capacity, reminders/cancel, event transitions, outage-safe saving. |
| Growth/privacy | Exact consent records, STOP exclusions, complete erasure, loyalty property/race tests, ungated review links, owner-only dashboard/AI/campaigns. |
| Reports/marketing | Previous-week IST facts, once/week transactional outbox, validated AI, all segments/recent-contact suppression, wa.me only. |
| Operations | Real accounts UI, safe preflight, guarded jobs/health, errors redacted, additive migrations, restart persistence, real-image smoke. |
| Recovery/load | Authenticated DB+files restore, failure exits, no source destruction; measured load meets every original threshold. |
| Release | All phase gates on one revision, current dependency triage, full authorized staging review, real devices/printer and pilot sign-off. |

## 7. Production configuration contract to reconcile during R25/R29

Values here are names/purposes only. No real secret belongs in this file, examples, logs or client bundles.

| Variables/config | Purpose and local stand-in |
|---|---|
| DATABASE_URL, POSTGRES_PASSWORD | App/PostgreSQL credentials; dedicated local test Postgres until real VPS. TEST_DATABASE_URL stays test-only. |
| DOMAIN, APP_URL; SITE_URL if still read | HTTPS routing and canonical links. Remove/align unused duplicate origins after checking all callers; fictional local URL until staging. |
| UPLOAD_DIR | Persistent local uploads; do not introduce an object-storage upload layer. |
| CRON_SECRET, OTP_SECRET, COOKIE_SECRET, WA_WEBHOOK_SECRET | Separate strong environment secrets; fixed fictional values only in isolated tests. |
| WHATSAPP_PROVIDER, WA_AKG_URL, WA_AKG_API_KEY, WA_AKG_SESSION_ID | Internal WA-AKG instance/session. Fake+explicit ALLOW_FAKE_WA is test-only. Real pairing requires H03. |
| AI_PROVIDER, OPENROUTER_API_KEY | Explicit fake/openrouter path per current adapter. Reconcile AI_MODEL if made configurable using the original provider contract. Direct Google/legacy Anthropic-only instructions must not remain after consolidation. |
| AI_MONTHLY_CAP, AI_DEVICE_DAILY_LIMIT, AI_AUTOREPLY_DAILY_LIMIT | Existing capped AI behavior; validate supported defaults and units in final docs. |
| S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_FORCE_PATH_STYLE | Real S3-compatible backup store; Floci dummy credentials locally. Do not substitute AWS_* names the code does not read. |
| BACKUP_ENCRYPTION_KEY, BACKUP_RETENTION_DAYS, BACKUP_PATHS |32-byte base64 key,35-day offsite retention default and verified files/session sources. Key recovery stored separately offline. |
| SEED_OWNER_PASSWORD, SEED_STAFF_PIN | Initial secure provisioning only; demo values must fail production seed/preflight. Do not reseed automatically at startup. |
| RATE_LIMIT_IP_ORDERS_PER_HOUR | Default60 in service; explicit documented high setting only for isolated load/E2E tests. |

Provider/model availability and exact service setup are verified at implementation/real-service evaluation time. This plan does not promise a particular live model or purchase any service.

## 8. Human production steps — do not block local repair work

Complete these on owned staging/production only, with credentials supplied outside Git. Append specific items to HUMAN-TODO during execution. No automated test may depend on them.

- [ ] **H01 — Restaurant facts and tax sign-off (Hariom + restaurant/accountant).** Supply actual bilingual menu/prices/photos, address/phone/hours, owner contact, GSTIN/FSSAI as applicable and tax mode/rate/inclusive-price decision. Enter through settings/menu after the candidate is usable; save tax confirmation and check a hand-calculated example bill. Do not infer legal/tax choices from the demo.
- [ ] **H02 — VPS, domain and access (Hariom/operator).** Provide owned staging/production VPS and DNS access; install Docker per tested deployment docs, point DNS, create private production env, configure persistent volumes, HTTPS and external uptime monitor. Expose only intended ports. Give GitHub merge/branch-protection permissions to the responsible human; no automatic main merge.
- [ ] **H03 — WhatsApp pairing (number owner).** Pair the spare/business SIM on the owned WA-AKG instance, verify the pinned instance's endpoint/webhook paths, set URL/API key/session/secret, send a real OTP/booking confirmation and test disconnect/recovery. Validate a recoverable session backup.
- [ ] **H04 — AI and privacy review (Hariom/restaurant).** Supply provider key/model, run the original real English/Hindi/Hinglish evaluation and review every result, including allergies and invented-price/offer cases. Review a week's auto-reply samples before unattended use. Review privacy wording for the restaurant.
- [ ] **H05 — Real bucket/key and fresh-host restore (operator).** Provision least-privilege backup storage, generate the key and retain password-manager/offline copies, run one real upload and restore into a new DB/files directory on a fresh host. Verify login, real upload hash, bill totals and WA session recovery. Record restore duration, restored backup timestamp and who signed off; never test by overwriting the live restaurant DB.
- [ ] **H06 — Staging security/load (Hariom/operator).** Run authorized Strix with test accounts/data against owned staging; read the complete result and resolve/justify findings. Run the actual load harness on an isolated _load/_test DB on target VPS hardware, with fakes, retaining measured output.
- [ ] **H07 — Real-server preflight and launch rehearsal (operator).** Run final preflight with the tested operator command/container; fix every FAIL and review warnings. Test secrets/headers/cookies, cron delivery, one failure/recovery alert, scheduled backup age, restart persistence and rollback rehearsal. Only then consider switching the real domain to the candidate.
- [ ] **H08 — Device, printer and pilot sign-off (restaurant + Hariom).** Low-end Android over4G: QR→order→status→bill, Hindi, long names, sold-out, bad network; staff tablet sound/wake lock;80mm KOT/bill margins/QR; takeaway, split payments, cancellation and day-end totals. Train staff on provider outage/banner and return-to-paper procedure; complete first-week pilot checklist and name the support contact.

## 9. Migration, rollback and release sequence

1. Pin the passing candidate revision/images and retain the last known working image/config. Take and verify a fresh backup before a real migration.
2. Rehearse upgrading a copy/scratch database from the pre-repair schema through all migrations; verify constraints and representative historical bills/points/consent. Prefer additive migrations. Never regenerate existing invoice numbers or recalculate settled bills as a migration shortcut.
3. Finish H01–H06 on staging, then deploy the candidate during an agreed restaurant window using the documented migrate-deploy path. Keep real seed one-time and explicit.
4. Complete H07/H08 before marking production ready. If an essential operational flow fails, keep customers on the previous working service/paper process.
5. For compatible additive schemas, rollback the app image without dropping data. For incompatible schema failure, stop writes and use the rehearsed restore into a separate destination; verify totals/data before switching. Do not blindly restore an old snapshot over orders accepted after the backup.
6. Observe health, cron, backup freshness, failed outbox, errors and representative transactions during the first week. Record human observations; this plan does not silently create a monitoring automation.

## 10. Audit finding closure map

| Finding | Required repair |
|---|---|
| F01 build/type errors | R01, R02, R28 |
| F02 money races | R06, R07, R14 |
| F03 redemption regeneration | R07, R14 |
| F04 message contracts | R09, R10, R12, R15 |
| F05 cron/monitoring auth | R04, R22 |
| F06 production scheduling | R09, R18, R25 |
| F07 OTP flow/atomicity | R01, R10, R14 |
| F08 booking timezone | R11 |
| F09 overnight capacity | R11 |
| F10 consent transaction/UI | R13 |
| F11 restore/backup failures | R21 |
| F12 AI privacy/quota/fakes | R02, R05, R17, R19 |
| F13 marketing audience | R13, R19 |
| F14 dashboard | R16 |
| F15 simulated load/stub | R00, R26 |
| F16 accounts | R01, R23 |
| F17 preflight | R24 |
| F18 weak/missing tests | R02, R08, R12, R14–R15, R21, R23, R28 |
| F19 origin/body boundary | R04 |
| F20 weekly report | R18 |
| F21 AI base prices | R05 |
| F22 backup frame integrity | R20 |
| F23 Hindi/tokens/accessibility | Per-surface units, R27 |
| F24 records/env handover | R00, R25, R29 |
| F25 dependency advisories | R03, R17/R19, R28 |
| Public balance/erasure inventory | R10, R13–R15, R19 |

**Ponytail constraints during repairs:** reuse the existing transaction-aware recalculation, cron guard, Prisma singleton, phone normalizer, rate limiter, provider/fake and money/date utilities before adding alternatives. No microservices, new ORM/auth framework, queue product, chart library, generic repository layer, multi-tenancy, online payments or uploads-to-S3 migration. The planned missing features and safeguards must still be completed.

**First implementation actions:** R00 preserve/correct baseline → R01 restore typecheck/build → R02 restore trustworthy test execution. Start feature fixes only with reproducible failing checks; continue through the dependency order until software gates pass, then complete the separately listed human launch steps.

