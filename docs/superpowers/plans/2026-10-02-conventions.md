# Conventions for Phases 2–6

Read this before any task in Phases 2–6. It records how the Phase 0–1 code actually works, so new tasks match it. If the code has drifted from this file, trust the code, and log a Deviation.

## 1. Repo facts (as built in Phases 0–1)

- Shell is PowerShell on Windows; commands in plans are `npm run …` / `npx …` and work in both shells. Docker CLI may need `C:/Users/Hario/AppData/Local/Programs/DockerDesktop/resources/bin` on PATH. Dev Postgres is on `127.0.0.1` (port from `POSTGRES_PORT`, may be 15432). Use `127.0.0.1`, never `localhost`, in database URLs.
- `src/lib/db.ts` exports `prisma`. `src/lib/audit/index.ts` exports `audit({ actorId, action, entity, entityId, data? })`.
- Auth: `src/lib/auth/session.ts` exports `requireUser(role?)` (throws `AuthError`), `requirePageUser(role?)` (redirects to `/login`), `getCurrentUser()`. Roles `OWNER` and `STAFF`. `requireUser("OWNER")` means owner only; `requireUser()` means any signed-in user.
- Money: integer paise; display with `formatINR` from `src/lib/money/format.ts`. Menu pricing: `priceLine(item, { variantId?, optionIds })` from `src/lib/menu/pricing.ts`.
- Localized DB text: `{ en, hi? }` via `src/lib/i18n/l10n.ts`; UI strings in `messages/en.json` and `messages/hi.json` (every key in both; real Hindi).
- Feature flags: `FEATURES` in `src/lib/features.ts`.
- Tests: `*.test.ts` unit (no DB), `*.int.test.ts` integration (test DB `restrosathi_test`, files run serially), `tests/e2e/*.spec.ts` Playwright (projects `mobile` 360 px and `desktop`; web server is a production build). Helpers in `tests/helpers/auth.ts`: `mockCookies()`, `asOwner()`, `asStaff()`, `asAnonymous()`. Integration tests that touch cookies must import the helper (it mocks `next/headers`).
- Seed: `prisma/seed.ts` creates Saffron Tadka settings, owner, one staff user, and the demo menu. Extend it for new data; keep it idempotent.
- **e2e data helper:** Task 15 creates `tests/helpers/db.ts` (a Prisma client on `TEST_DATABASE_URL`, `resetOperationalData()` that truncates orders, sessions, bills, payments, bookings, messages, OTP, rate hits, feedback, loyalty and similar operational tables while keeping Settings, users, menu and tables, plus small setters such as `markSoldOut(itemId)`, `setTaxMode(...)`, `createLongHindiItem()`, `insertBackupRun(...)`). Every e2e spec that changes data calls `resetOperationalData()` in `beforeEach`. Later tasks extend this file instead of creating another helper. Seeded tables in non-production get fixed codes `TESTCODE01`…`TESTCODE08` (exported as `TABLE_CODES` from `tests/helpers/db.ts`); the production seed generates random codes.

## 2. Schema and migrations

- Edit `prisma/schema.prisma`, then create a migration folder under `prisma/migrations/` (`npx prisma migrate dev --name <name>` against the dev database; if that is unavailable, write the SQL with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` and add it by hand). Commit the migration with the schema change.
- **Test database setup must apply real migrations, not `db push`**, as soon as a task adds raw SQL (partial unique indexes, CHECK constraints). Task 12 changes `tests/setup/db.ts` to `prisma migrate reset --force --skip-generate --skip-seed` (against the test URL) and then seeds. After that, never use `db push` for tests.
- Raw SQL goes in the migration file by hand after the generated statements, with a comment saying why.
- **Hand-written indexes and `migrate dev`:** Prisma does not know about raw partial indexes or CHECK constraints, so `prisma migrate dev` / `migrate diff` will try to `DROP INDEX` them in later migrations. When generating a migration, delete any generated `DROP INDEX`/`DROP CONSTRAINT` line that targets an index or constraint you wrote by hand. If `migrate dev` complains about drift on a database that was set up with `migrate deploy`, generate the SQL with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <a scratch database url> --script`, review it, save it as a new migration folder, and apply it with `npm run db:migrate`.
- Add new timestamps as `@db.Timestamptz(3)`. Money columns are `Int` (paise). Enums for statuses.

## 3. Patterns to reuse

- **Server action:** `"use server"`; call `requireUser(...)` first (unless the task says public); validate input with Zod; do the work in a function from `src/lib/<area>/`; return `{ ok: true, … }` or `{ ok: false, error: <code> }`; never throw raw errors to the client. Every state-changing action writes an `audit()` row when the task says so.
- **Route handler:** same, and for data-changing handlers called from browsers accept only `POST` with a same-origin `Origin`/`Host` match. **Exempt** (they authenticate with secrets instead and have no browser Origin): cron routes (`Authorization: Bearer ${CRON_SECRET}`, constant-time compare) and the WhatsApp webhook (secret token). Public JSON routes enforce a 100 KB body limit by reading the body with a size cap; the global server-action body limit is raised for the photo upload (log this as a Deviation from spec section 12 if you have to), and every public action's Zod schema bounds its payload.
- **Transactions:** `prisma.$transaction(async (tx) => …)`. For row locks use `tx.$queryRaw` with `SELECT … FOR UPDATE`. For advisory locks use `tx.$executeRaw` (`SELECT pg_advisory_xact_lock(...)` through `$queryRaw` fails because Prisma cannot read a `void` column). **A unique-constraint error inside a Postgres transaction aborts the whole transaction**, so never "catch P2002 and re-read" inside the same `$transaction`: either take an advisory lock first, use `INSERT … ON CONFLICT DO NOTHING` and then read, or catch the error **outside** the transaction (after it has rolled back) and read the winner there.
- **Lock order (to avoid deadlocks), always in this order:** (1) the table/session advisory lock, (2) the bill row, (3) the customer row, (4) the invoice counter. Never take them in another order.
- **Concurrency tests:** the test database URL carries `?connection_limit=20&pool_timeout=30`; interactive transactions that are expected to queue use `{ maxWait: 20_000, timeout: 30_000 }`. Concurrency tests that count numbers (invoice numbers, capacity) first reset the relevant tables (`InvoiceCounter`, `Bill`, `Payment`, `Booking`) so a re-run starts from zero. Concurrency tests run the same assertions for at least 3 loops where the plan says so.
- **Rate limit:** Task 13 adds `src/lib/rate-limit.ts` (`checkRate(key, limit, windowMs)` backed by a `RateHit` table). Reuse it; do not write another.
- **Device id:** Task 13 adds `src/lib/device.ts` (`getDeviceId()`, cookie `rs_device`, random 128-bit, httpOnly, 400 days; may only be called from a server action or route handler). Reuse it.
- **Polling UI:** client component calling a server action or `GET` route every 3 s with `AbortController`, pause when the tab is hidden, back off on errors.
- **i18n in UI:** `useTranslations`/`getTranslations`; no hard-coded visible strings; every new key in `en.json` and `hi.json`.
- **UI work:** for each new surface run `$impeccable shape` → build → `$impeccable audit` and `harden`; staff, kitchen and billing screens stay conservative and fast to read. Never run design skills on billing math, the order state machine or auth. Run `$ponytail-review` before each commit.

## 3b. Test-only runtime switches (Phase 4 onward)

The Playwright web server is a production build, so test fakes cannot depend on `NODE_ENV`. Instead `playwright.config.ts` (modified in Task 28) passes these env vars to the server: `WHATSAPP_PROVIDER=fake`, `ALLOW_FAKE_WA=1`, `FAKE_WA_OUTBOX=test-results/fake-wa-outbox.jsonl`, `FAKE_WA_CONTROL=test-results/fake-wa-control.txt`, `AI_PROVIDER=fake`, `CRON_SECRET`, `OTP_SECRET`, `COOKIE_SECRET`, `WA_WEBHOOK_SECRET` (fixed test values), and large rate limits (`RATE_LIMIT_IP_ORDERS_PER_HOUR=100000`). The fake WhatsApp provider **refuses to construct unless `ALLOW_FAKE_WA=1`**, and Task 47's preflight fails if `ALLOW_FAKE_WA` is set or the provider is `fake` in production. The control file holds one word read on every send/status call: `connected` (default when the file is missing), `disconnected`, or `fail` (sends throw). e2e tests write to it to simulate outages and clear the outbox file in `beforeEach`.

## 4. Allowed dependencies by phase (anything else: rule 4 of the No-stop protocol in `AGENTS.md`)

| Phase | Runtime | Dev |
|---|---|---|
| 2 | `qrcode` (QR images), `@anthropic-ai/sdk` (AI, task 18) | `@types/qrcode` |
| 3 | none | none |
| 4 | none (use `fetch`; cron is a route + a sidecar container) | none |
| 5 | none | none |
| 6 | `@aws-sdk/client-s3` (off-site backup) | `@floci/testcontainers` (optional), `autocannon` (optional; a plain Node script is preferred) |

## 5. Things that need a human (never block on these)

Tasks and steps marked **[HUMAN]** in `docs/QUEUE.md` or in a plan are skipped by Codex. Codex builds everything around them with fakes and tests, appends a line to `docs/HUMAN-TODO.md` (what, why, exact command or click path), and moves on. Typical human items: real VPS and domain, the WhatsApp spare SIM pairing, the Anthropic API key, the real backup bucket, Strix runs, real-device QA, the pilot sign-off. Never put real secrets in the repo; `.env.example` only gets fictional placeholders.

## 6. Quality rules that apply to every task

- Test first. Show real output. One commit per task, then the `docs/PROGRESS.md` entry.
- Every new page: axe zero serious violations, no horizontal scroll at 360 px with long Hindi text, targets ≥ 44 px, visible focus, `prefers-reduced-motion` respected.
- Every new server action and route: an authorization test (anonymous rejected; wrong role rejected where relevant).
- Never trust the client for prices, totals, statuses or ids that decide access.
- WhatsApp or AI failures never block an order, bill or booking.
- Keep money in paise end to end; a float anywhere near money is a bug.
