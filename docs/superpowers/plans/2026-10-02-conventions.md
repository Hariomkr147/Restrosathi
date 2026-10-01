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

## 2. Schema and migrations

- Edit `prisma/schema.prisma`, then create a migration folder under `prisma/migrations/` (`npx prisma migrate dev --name <name>` against the dev database; if that is unavailable, write the SQL with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` and add it by hand). Commit the migration with the schema change.
- **Test database setup must apply real migrations, not `db push`**, as soon as a task adds raw SQL (partial unique indexes, CHECK constraints). Task 12 changes `tests/setup/db.ts` to `prisma migrate reset --force --skip-generate --skip-seed` (against the test URL) and then seeds. After that, never use `db push` for tests.
- Raw SQL goes in the migration file by hand after the generated statements, with a comment saying why.
- Add new timestamps as `@db.Timestamptz(3)`. Money columns are `Int` (paise). Enums for statuses.

## 3. Patterns to reuse

- **Server action:** `"use server"`; call `requireUser(...)` first (unless the task says public); validate input with Zod; do the work in a function from `src/lib/<area>/`; return `{ ok: true, … }` or `{ ok: false, error: <code> }`; never throw raw errors to the client. Every state-changing action writes an `audit()` row when the task says so.
- **Route handler:** same, and for data-changing handlers accept only `POST` with a same-origin `Origin`/`Host` match. Cron handlers require `Authorization: Bearer ${CRON_SECRET}` (constant-time compare).
- **Transactions:** `prisma.$transaction(async (tx) => …)`. For row locks use `tx.$queryRaw` with `SELECT … FOR UPDATE`. Concurrency tests use `Promise.all` of real calls against the test DB.
- **Rate limit:** Task 13 adds `src/lib/rate-limit.ts` (`checkRate(key, limit, windowMs)` backed by a `RateHit` table). Reuse it; do not write another.
- **Device id:** Task 13 adds `src/lib/device.ts` (`getDeviceId()`, cookie `rs_device`, random 128-bit, httpOnly, 400 days; may only be called from a server action or route handler). Reuse it.
- **Polling UI:** client component calling a server action or `GET` route every 3 s with `AbortController`, pause when the tab is hidden, back off on errors.
- **i18n in UI:** `useTranslations`/`getTranslations`; no hard-coded visible strings; every new key in `en.json` and `hi.json`.
- **UI work:** for each new surface run `$impeccable shape` → build → `$impeccable audit` and `harden`; staff, kitchen and billing screens stay conservative and fast to read. Never run design skills on billing math, the order state machine or auth. Run `$ponytail-review` before each commit.

## 4. Allowed dependencies by phase (anything else: stop condition 4)

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
