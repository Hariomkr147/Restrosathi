# Work queue

The order Codex works in when you say **"Run the queue"** (see `AGENTS.md`, queue mode). Codex finds the first item that is not yet logged in `docs/PROGRESS.md` and continues from there. It never reorders items, and it never edits this file except to tick the box in the last column when an item is finished.

How to read it: a **Task** row is done when `docs/PROGRESS.md` has an entry headed `## Task N: …`. A **Gate** row is done when it has `## Phase N summary`. A phase's first Task starts on the branch named in the row (create it from the current branch's last commit if it does not exist). Plan files are in `docs/superpowers/plans/`.

| # | Item | What | Plan file | Branch | Done |
|---|---|---|---|---|---|
| 1 | Task 7 | Home page, SEO, feature flags | `2026-10-01-restrosathi-implementation-plan.md` (Part B) | `phase-1-menu-site` | [ ] |
| 2 | Task 8 | Settings editor | same | `phase-1-menu-site` | [ ] |
| 3 | Task 9 | Menu editor, sold-out switch, photo upload | same | `phase-1-menu-site` | [ ] |
| 4 | Task 10 | Accessibility, performance, Hindi gates | same | `phase-1-menu-site` | [ ] |
| 5 | Gate 1 | Phase 1 exit checks + summary | same (Part A, Phase 1) | `phase-1-menu-site` | [ ] |
| 6 | Task 11 | Tables, QR codes, printable sheet | `2026-10-02-phase-2-qr-ordering-plan.md` | `phase-2-qr-ordering` | [ ] |
| 7 | Task 12 | Dining sessions, one active per table | same | `phase-2-qr-ordering` | [ ] |
| 8 | Task 13 | Order placement, idempotency, rate limits | same | `phase-2-qr-ordering` | [ ] |
| 9 | Task 14 | Order state machine, line voids | same | `phase-2-qr-ordering` | [ ] |
| 10 | Task 15 | Customer table page `/t/[code]` | same | `phase-2-qr-ordering` | [ ] |
| 11 | Task 16 | Staff board with reliability features | same | `phase-2-qr-ordering` | [ ] |
| 12 | Task 17 | KOT print | same | `phase-2-qr-ordering` | [ ] |
| 13 | Task 18 | AI menu assistant | same | `phase-2-qr-ordering` | [ ] |
| 14 | Task 19 | Production packaging (code only) | same | `phase-2-qr-ordering` | [ ] |
| 15 | Gate 2 | Authz matrix, security review, exit E2E, summary | same (Phase 2 gate) | `phase-2-qr-ordering` | [ ] |
| 16 | Task 20 | Staff-entered orders, takeaway | `2026-10-02-phase-3-billing-plan.md` | `phase-3-billing` | [ ] |
| 17 | Task 21 | Billing engine, tax settings | same | `phase-3-billing` | [ ] |
| 18 | Task 22 | Generate bill, discounts, bill screens | same | `phase-3-billing` | [ ] |
| 19 | Task 23 | Invoice numbers, settlement | same | `phase-3-billing` | [ ] |
| 20 | Task 24 | Cancel settled bill (owner) | same | `phase-3-billing` | [ ] |
| 21 | Task 25 | 80 mm bill print | same | `phase-3-billing` | [ ] |
| 22 | Task 26 | Day-end report | same | `phase-3-billing` | [ ] |
| 23 | Task 27 | Customer bill view from snapshot | same | `phase-3-billing` | [ ] |
| 24 | Gate 3 | Billing exit E2E, money review, summary | same (Phase 3 gate) | `phase-3-billing` | [ ] |
| 25 | Task 28 | WhatsApp adapter, phone, webhook | `2026-10-02-phase-4-whatsapp-bookings-plan.md` | `phase-4-whatsapp-bookings` | [ ] |
| 26 | Task 29 | notify outbox, cron, banner | same | `phase-4-whatsapp-bookings` | [ ] |
| 27 | Task 30 | OTP, verified-device cookie | same | `phase-4-whatsapp-bookings` | [ ] |
| 28 | Task 31 | Booking rules, request form | same | `phase-4-whatsapp-bookings` | [ ] |
| 29 | Task 32 | Staff bookings, safe confirm, reminders, cancel | same | `phase-4-whatsapp-bookings` | [ ] |
| 30 | Task 33 | Event packages and enquiries | same | `phase-4-whatsapp-bookings` | [ ] |
| 31 | Task 34 | AI auto-reply, inbox | same | `phase-4-whatsapp-bookings` | [ ] |
| 32 | Task 35 | Owner escalation | same | `phase-4-whatsapp-bookings` | [ ] |
| 33 | Task 36 | Privacy page, retention, enable flags | same | `phase-4-whatsapp-bookings` | [ ] |
| 34 | Gate 4 | Exit E2E, security review, summary | same (Phase 4 gate) | `phase-4-whatsapp-bookings` | [ ] |
| 35 | Task 37 | Customers, consent, erasure | `2026-10-02-phase-5-growth-plan.md` | `phase-5-growth` | [ ] |
| 36 | Task 38 | Loyalty ledger | same | `phase-5-growth` | [ ] |
| 37 | Task 39 | Feedback, Google review link | same | `phase-5-growth` | [ ] |
| 38 | Task 40 | Owner dashboard | same | `phase-5-growth` | [ ] |
| 39 | Task 41 | AI feedback themes, reply drafts | same | `phase-5-growth` | [ ] |
| 40 | Task 42 | Weekly report | same | `phase-5-growth` | [ ] |
| 41 | Task 43 | Marketing drafts, wa.me links | same | `phase-5-growth` | [ ] |
| 42 | Gate 5 | Exit E2E, privacy review, summary | same (Phase 5 gate) | `phase-5-growth` | [ ] |
| 43 | Task 44 | Encrypted off-site backups, restore | `2026-10-02-phase-6-golive-plan.md` | `phase-6-golive` | [ ] |
| 44 | Task 45 | Monitoring, alerts, system page | same | `phase-6-golive` | [ ] |
| 45 | Task 46 | Load test | same | `phase-6-golive` | [ ] |
| 46 | Task 47 | Accounts, preflight, pilot docs | same | `phase-6-golive` | [ ] |
| 47 | Gate 6 | Final security pass, audit, README, final report | same (Phase 6 gate) | `phase-6-golive` | [ ] |

## Gate procedure (the same for every Gate row)

1. Do every checkbox in that phase's gate section, in order. A failed item is fixed with a test first; if it still fails after the No-stop protocol's attempts, record `GATE NOT PASSED` in the summary and carry on. Never weaken a check.
2. Write `## Phase N summary` in `docs/PROGRESS.md` (what exists, test counts, Deviations, human items).
3. Make sure `docs/HUMAN-TODO.md` is up to date for the phase.
4. Commit. The next phase's branch is created from this commit. **Do not merge to `main`, do not delete branches, do not force-push.**

## Human steps never block the queue

Anything a person must do (real server, real WhatsApp pairing, API keys, real bucket, real devices, Strix, the pilot) goes to `docs/HUMAN-TODO.md` and the queue continues with fakes and tests. Never stop the queue for a human step.

## Nothing stops the queue

Queue mode never asks a question and never marks itself blocked. A task it cannot finish is parked (see "No-stop protocol" in `AGENTS.md`) and the queue moves on. When the last Gate is done, or the usage limit is close, Codex writes `docs/FINAL-REQUEST.md` (keys, access, decisions, parked tasks) and prints it. That is the only time it asks for anything.
