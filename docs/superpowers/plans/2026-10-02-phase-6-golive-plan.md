# Phase 6 Plan: Go-live hardening + pilot (Tasks 44–47)

> **For Codex:** Follow `AGENTS.md` and `docs/superpowers/plans/2026-10-02-conventions.md`. Tick checkboxes as you go. One commit per task, then the `docs/PROGRESS.md` entry. Branch: `phase-6-golive`, created from the last commit of `phase-5-growth`.
> **Spec:** sections 12 (security, privacy), 13 (testing, Phase 6 line).
> **Much of "go-live" is human work** (real server, real bucket, real devices, the first restaurant). Codex builds the tooling and proves it against local stand-ins; every real-world step goes to `docs/HUMAN-TODO.md` with exact commands.

**Goal:** The system can be backed up off-site and restored, watches itself, has been load-tested, can be set up for a real restaurant (accounts, preflight check), and comes with a pilot checklist.

**New dependencies:** `@aws-sdk/client-s3` (Task 44). Dev: `@floci/testcontainers` (optional, Task 44 tests; the Docker Compose profile below is the fallback).

**Floci rules (from `AGENTS.md`):** Floci (`floci/floci:latest`, port `127.0.0.1:4566`, dummy credentials, **no Docker socket mount**) is the local S3 stand-in for **tests only**. It is an emulator: the real bucket must still be tested once by a human.

**Exit criteria (all must pass here; the human ones are in `docs/HUMAN-TODO.md`):** backup → upload to Floci → restore into a scratch database round-trips key tables and files exactly; wrong key and tampered backups are refused; monitoring alerts fire on simulated failures and are not repeated within 6 hours; load test p95 order placement < 1 s locally with zero errors; preflight fails on demo credentials and passes on a correctly configured test environment; owner can create staff and change passwords; pilot checklist and real-device QA documents exist.

---

## Task 44: Off-site encrypted backups and a restore drill

**Files:**
- Modify: `package.json`, `.env.example`, `.env.production.example`, `docker-compose.prod.yml` (replace the simple Task 19 backup loop with the new backup service; keep the local 14-day dump as a second layer), `prisma/schema.prisma` (+ migration: `BackupRun { id, at, ok, bytes?, objectKey?, error? }`), `docs/DEPLOY.md`
- Create: `scripts/backup/crypto.ts`, `scripts/backup/crypto.test.ts`, `scripts/backup/s3.ts`, `scripts/backup/run.ts`, `scripts/backup/restore.ts`, `scripts/backup/retention.ts`, `scripts/backup/retention.test.ts`, `scripts/backup/backup.int.test.ts`, `docker/backup/Dockerfile`, `docker-compose.floci.yml`, `docs/RESTORE.md`

**Behaviour:**
- `run.ts` (runs inside a `backup` container with `pg_dump` available; image from `docker/backup/Dockerfile`, Node 22 plus the PostgreSQL 17 client): `pg_dump` the database in custom format → create one tar archive with the dump, the uploads directory and the WA-AKG session volume path (`BACKUP_PATHS`, a comma-separated list; missing paths are skipped with a warning, not an error) → gzip → **encrypt with AES-256-GCM** (key `BACKUP_ENCRYPTION_KEY`, 32 bytes base64; streaming in 1 MiB chunks, each chunk authenticated; file header with a magic string, version and per-file random salt/nonce base) → upload to the S3-compatible bucket (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE=true`) at `restrosathi/<YYYY>/<MM>/restrosathi-<UTC timestamp>.tar.gz.enc` together with `<same>.sha256` (hash of the encrypted file) → delete objects older than `BACKUP_RETENTION_DAYS` (default 35) → insert a `BackupRun` row (success or failure with a truncated error). Runs daily at about 03:00 IST (the container loop) and on demand.
- `restore.ts <objectKey> --target-db <url> --confirm`: downloads the object and its `.sha256`, verifies the hash, decrypts (GCM authentication failure aborts with a clear message), extracts, and `pg_restore`s into the **target database, which must not be the one in `DATABASE_URL`** unless `--i-know-this-overwrites` is also passed; restores files into `--files-dir`. It prints row counts for key tables.
- The encryption key and S3 secrets only come from the environment, are never logged, and `.env.production.example` carries placeholders.
- `docker-compose.floci.yml`: service `floci` (`floci/floci:latest`, `ports: ["127.0.0.1:4566:4566"]`, no volumes from the Docker socket) used by the tests; the tests create the bucket through the SDK. If `@floci/testcontainers` is used instead, document it in PROGRESS.

- [ ] **Step 1: Write failing tests.**
  - `crypto.test.ts`: encrypt→decrypt round trip for 0 bytes, 1 byte, 1 MiB − 1, exactly 1 MiB, and a 50 MiB stream (compare SHA-256 of input and output); wrong key fails with a clear error and no partial plaintext file is left; flipping one ciphertext byte fails; truncating the file fails (final-chunk marker); two encryptions of the same input differ. (Do not assert on memory use; process with Node streams and `pipeline`, never whole-file buffers, and check the 50 MiB case by comparing hashes.)
  - `retention.test.ts`: with objects dated 1, 34, 35, 36, 90 days old and retention 35 → exactly the 36- and 90-day objects are selected; never deletes the newest object even if everything is "old"; a listing error deletes nothing.
  - `backup.int.test.ts` (needs Docker; starts Floci; skip with a clear message only if Docker is absent, and then record a Deviation): seed a few rows, put a small file in a temp uploads dir, run `run.ts` against Floci → object and hash exist, `BackupRun` row ok; run `restore.ts` into a scratch database `restrosathi_restore_test` and a temp files dir → row counts of `Settings`, `User`, `MenuItem`, `Bill`, `Booking` equal the source and the uploaded file hash matches; restoring into the source `DATABASE_URL` without the override flag is refused; a corrupted `.sha256` or object is refused; a failing upload (Floci stopped) writes a failed `BackupRun` row and a non-zero exit code.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** (use streams; no whole-file buffering).
- [ ] **Step 4: Run** the unit tests and the Floci integration test. Expected: PASS.
- [ ] **Step 5: Write `docs/RESTORE.md`:** the restore drill step by step (fresh VPS, install Docker, fetch the latest object, restore to a new database, start the app against it, check login, a bill, an upload), and a checklist to sign off after a real drill.
- [ ] **Step 6: Commit** `feat: encrypted off-site backups with verified restore`, then PROGRESS. Add **[HUMAN]** items: create the real bucket and a least-privilege key; generate `BACKUP_ENCRYPTION_KEY` and store it in a password manager **and** offline (a lost key means unreadable backups); run the real-bucket test once; run the restore drill on a fresh VPS and tick `docs/RESTORE.md`.

---

## Task 45: Monitoring, alerts and a system page

**Files:**
- Modify: `prisma/schema.prisma` (+ migration: `ErrorLog { id, at, where, message, digest }`, `AlertState { key @id, active, lastSentAt? }`), `src/lib/whatsapp/notify.ts` (new kind `SYSTEM_ALERT`, template in both languages), `src/app/api/health/route.ts` (unchanged public output), `docker-compose.prod.yml` (cron loop adds `/api/cron/alerts` every 5 minutes), `src/app/admin/layout.tsx` (nav: System, owner only), `messages/*.json`, `src/lib/auth/authz-matrix.int.test.ts`
- Create: `src/instrumentation.ts`, `src/lib/errors.ts`, `src/lib/errors.int.test.ts`, `src/lib/monitoring/checks.ts`, `src/lib/monitoring/checks.int.test.ts`, `src/lib/monitoring/alerts.ts`, `src/lib/monitoring/alerts.int.test.ts`, `src/app/api/cron/alerts/route.ts`, `src/app/api/health/deep/route.ts`, `src/app/admin/system/page.tsx`, `docs/MONITORING.md`, `tests/e2e/system.spec.ts`

**Interfaces:**
- `reportError(error, where)` writes an `ErrorLog` row (message truncated to 300 characters, **no stack traces with file paths, no request bodies, no phone numbers**: strip digit sequences of 7+ and email-like strings; `digest` = hash of the error name + message for grouping). `instrumentation.ts` exports `onRequestError` (Next's hook) calling `reportError`; server actions that catch unexpected errors also call it. Log rows older than 30 days are deleted by the retention job (extend Task 36's `runRetention` and its test).
- `runChecks(now?)` returns `Array<{ key; ok; detail }>` for: `db` (a trivial query), `disk` (free space on the uploads/backup path via `fs.statfs`; fails above 85 % used), `backup` (latest successful `BackupRun` within 26 hours), `outbox` (no `FAILED` rows created in the last hour and no `PENDING` row older than 30 minutes), `whatsapp` (not `disconnected` for more than 30 minutes; track the first-seen time in `AlertState`), `ai` (fails at or above 80 % of the monthly cap, so the owner is told before it runs out, and again when exhausted), `errors` (fewer than 20 `ErrorLog` rows in the last 10 minutes).
- `evaluateAlerts({ now?, notifyOwner })`: for each failing check set `AlertState.active`; send at most **one `SYSTEM_ALERT` per key per 6 hours** to `Settings.ownerAlertPhone` (queued through `notify`); when a check recovers send one "resolved" alert; nothing when no owner phone is set (the system page still shows it). `POST /api/cron/alerts` runs `runChecks` + `evaluateAlerts` (cron auth).
- `GET /api/health/deep` requires `Authorization: Bearer ${CRON_SECRET}` and returns the check results (for an external uptime tool or the human); the public `/api/health` stays minimal.
- `/admin/system` (OWNER): current check statuses, last backup time and size, outbox counts, WhatsApp status, AI usage this month, the last 50 errors (message and time only).
- `docs/MONITORING.md` is for the human: set up an external uptime monitor on `https://<domain>/api/health` (they work even if the whole server is down, which the internal alerts cannot), where to see alerts, and optionally add Sentry later.

- [ ] **Step 1: Write failing tests.** `errors.int.test.ts`: phone digits and emails scrubbed, long messages truncated, same error groups by digest. `checks.int.test.ts`: each check passes on healthy data and fails on constructed bad data (old backup, failed outbox rows, disk threshold via an injected `statfs`, disconnected WhatsApp for 31 minutes). `alerts.int.test.ts`: first failure sends one alert; a second run within 6 hours sends none; after 6 hours sends again; recovery sends one "resolved"; no owner phone → nothing queued and no crash; the deep health route and cron route reject wrong secrets and the public health route reveals nothing sensitive. e2e: owner sees `/admin/system` with a red check after a failed `BackupRun` row is inserted; staff cannot open it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: error log, health checks, owner alerts and system page`, then PROGRESS. Add **[HUMAN]** items: external uptime monitor; test a real alert by stopping the backup job.

---

## Task 46: Load test (20 tables ordering, 3 staff boards polling)

**Files:**
- Modify: `package.json` (`"loadtest": "tsx scripts/loadtest/run.ts"`), `prisma/schema.prisma` (+ migration only if indexes are added), `src/app/t/[code]/actions.ts`, `src/app/admin/board/BoardClient.tsx` (only if the thin routes below are adopted by the client)
- Create: `src/app/api/t/[code]/orders/route.ts`, `src/app/api/board/route.ts`, `src/app/api/orders-route.int.test.ts`, `scripts/loadtest/run.ts`, `scripts/loadtest/stats.ts`, `scripts/loadtest/stats.test.ts`, `docs/loadtest/README.md`

**Behaviour:**
- Thin HTTP entry points so the load test exercises the real HTTP stack: `POST /api/t/[code]/orders` (public JSON wrapper around the **same** `placeOrder` function and the same device/IP rate limiting as the server action; same-origin check on `Origin`/`Host`) and `GET /api/board` (wrapper around `getBoard`, `requireUser()`; `Cache-Control: no-store`). The server action and the routes must share one code path (a test calls both and compares results).
- `scripts/loadtest/run.ts`: refuses to run unless `NODE_ENV` is not production and `DATABASE_URL` points at a database whose name ends in `_load` or `_test`. It creates (or reuses) 20 tables, **creates 3 staff sessions directly in the test database** (random token, store its SHA-256 in `AuthSession`, send `Cookie: rs_session=<token>`; server actions cannot be called from a plain Node script), and for 5 minutes (configurable) runs 20 simulated customers, each with its own cookie jar (device id) and its own `X-Forwarded-For` address, placing an order every 20–40 s through `POST /api/t/[code]/orders` (random items from the seeded menu, unique idempotency keys, some deliberate duplicate submissions), while the 3 staff clients poll `GET /api/board` every 3 s and accept/ready/serve orders at human-like intervals by calling the library functions (`acceptOrder`, `markReady`, `markServed`) directly against the same database. Set `RATE_LIMIT_IP_ORDERS_PER_HOUR` high for the run and log that fact in the results. It starts a production build of the app itself (`next start`) with `AI_PROVIDER=fake`, `WHATSAPP_PROVIDER=fake`. Output: `docs/loadtest/results-<date>.md` and `.json` with request counts, error counts, p50/p95/p99 for order placement and for board polls, orders created vs duplicates suppressed, and the Postgres connection count peak.
- **Pass thresholds:** order placement p95 < 1000 ms; board poll p95 < 500 ms; zero 5xx; zero lost or duplicated orders (created count equals unique keys sent); no Prisma pool timeouts in the log.
- If a threshold fails: profile the slow query, add the missing index with a migration (likely `Order(status, placedAt)`, `OrderLine(orderId)`, `DiningSession(tableId, status)`, `Booking(slotStart)`), re-run, and record before/after numbers. Do not weaken the thresholds.

- [ ] **Step 1: Write failing tests.** `stats.test.ts`: percentile calculation (p50/p95/p99 on known arrays, empty array, single value, interpolation rule documented); `orders-route.int.test.ts`: the route and the server action create the same order shape and share rate limits; cross-origin POST rejected; invalid JSON 400; board route anonymous → 401; board route returns the same data as `getBoard`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the routes and the load test script.
- [ ] **Step 4: Run** unit and integration tests, then **run the load test** for 5 minutes on this machine. Save the results files. Record the machine description (CPU cores, RAM) in the results. Expected: thresholds pass. If not, fix as described above.
- [ ] **Step 5: Commit** `feat: load test harness and thin order and board routes`, then PROGRESS (include the numbers). Add **[HUMAN]** item: re-run `npm run loadtest` against staging on the real VPS size (numbers on a laptop are indicative only).

---

## Task 47: Account management, preflight check, pilot checklist

**Files:**
- Modify: `src/app/admin/layout.tsx` (nav: Staff, owner only), `messages/*.json`, `package.json` (`"preflight": "tsx scripts/preflight.ts"`), `src/lib/auth/authz-matrix.int.test.ts`, `README.md`
- Create: `src/lib/auth/accounts.ts`, `src/lib/auth/accounts.int.test.ts`, `src/app/admin/staff/page.tsx`, `src/app/admin/staff/actions.ts`, `src/app/admin/account/page.tsx`, `scripts/preflight.ts`, `scripts/preflight-checks.ts`, `scripts/preflight-checks.test.ts`, `docs/PILOT-CHECKLIST.md`, `docs/QA-REAL-DEVICE.md`, `docs/HANDOVER.md`, `tests/e2e/accounts.spec.ts`

**Interfaces:**
- Accounts (`src/lib/auth/accounts.ts`; **no design skills on this code**): `createStaff({ name, pin })` (OWNER; PIN 4–6 digits, hashed with the same scrypt helper; the Phase 0 login at `/login/staff` picks the person by name (`getActiveStaff`) and then checks the PIN, so PINs need not be unique and no other person's PIN is ever revealed; staff names must be unique among active staff); `resetStaffPin(userId, pin)`; `setStaffActive(userId, active)` (deactivating ends their sessions); `changeOwnerPassword(current, next)` (requires the current password; next ≥ 10 characters; ends all other sessions); every action `requireUser("OWNER")` and audited (`account.create`, `account.pin_reset`, `account.active`, `account.password`), audit data never contains the PIN or password. Lockout rules from Task 4 still apply to the new PINs.
- `/admin/staff` (OWNER): list, add, reset PIN, deactivate/reactivate; `/admin/account` (OWNER): change password.
- `scripts/preflight.ts` (`npm run preflight`) checks the **current environment and database** and prints PASS/FAIL per line, exiting non-zero on any FAIL: `NODE_ENV=production`; `APP_URL` starts with `https://`; `CRON_SECRET`, `OTP_SECRET`, `COOKIE_SECRET`, `WA_WEBHOOK_SECRET` are at least 32 characters and not the example values; `BACKUP_ENCRYPTION_KEY` decodes to 32 bytes; the demo owner password and demo staff PIN **do not verify** against any active user; no active user has a null password/PIN hash; `Settings.name` is not the demo name unless `ALLOW_DEMO_NAME=1`; address, phone, `ownerAlertPhone` set and valid; opening hours set; `taxModeConfirmedAt` is set (the owner has saved the tax settings at least once) and, for `REGULAR`, a valid GSTIN; `ALLOW_FAKE_WA` is not set; FSSAI set (warning only); at least one active table; at least 5 available menu items; `WHATSAPP_PROVIDER` is not `fake`; `AI_PROVIDER` is not `fake` when AI features are enabled (warning); a successful `BackupRun` in the last 26 hours; the retention and cron sidecars are configured (`CRON_SECRET` present). Each check is a pure function over a snapshot (`{ env, settings, users, tables, itemCount, lastBackup }`) so it can be unit-tested.
- `docs/PILOT-CHECKLIST.md`: a before-visit, install-day and first-week checklist for the first restaurant: menu with real prices and photos in both languages, hours, tax mode confirmed by their accountant, GSTIN/FSSAI entered, test the 80 mm printer from the browser (paper size and margins), print and laminate QR cards, staff PINs, the owner's WhatsApp alert number, test order → kitchen → bill → settle → print, day-end report check, off-site backup running, WhatsApp pairing and the disconnected banner understood, who to call, how to roll back to paper billing if something fails, and a sign-off block. `docs/QA-REAL-DEVICE.md`: the real-device scenarios on a low-end Android over 4G (QR scan → order → status → bill; Hindi; bad network; sold-out; sound and wake lock on the staff tablet; printing), each with a pass/fail line.
- `docs/HANDOVER.md`: how to run and deploy, environment variables, the cron jobs, backups and restore, who owns which secret, and where each module lives.

- [ ] **Step 1: Write failing tests.** `accounts.int.test.ts`: owner creates a staff member who can then sign in at `/login/staff` with the PIN (use the real login function); PIN length bounds; duplicate-PIN rule per the chosen design; reset PIN invalidates the old PIN; deactivated staff cannot sign in and their live session stops working; password change needs the right current password, enforces the length, and ends other sessions; no audit row contains the secret; STAFF and anonymous rejected for every action; the lockout still applies. `preflight-checks.test.ts`: a fully valid snapshot passes; each individual failure (demo password verifies, short secret, `http://` URL, fake WhatsApp provider, `REGULAR` without GSTIN, no tables, no recent backup, demo name) produces exactly that FAIL. e2e: owner adds a staff member, that person signs in on a second context and can open the board but not `/admin/staff`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the accounts, pages, preflight and the three documents.
- [ ] **Step 4: Run** tests; then run `npm run preflight` on the **development** environment and record that it fails for the expected reasons (demo credentials, fake provider, not production). Paste the output in PROGRESS.
- [ ] **Step 5: Commit** `feat: staff and owner account management, preflight check and pilot docs`, then PROGRESS. Add **[HUMAN]** items: run the pilot checklist with the first restaurant; run the real-device QA matrix; run `npm run preflight` on the real server and fix every FAIL; sign-off.

---

## Phase 6 gate and final wrap-up

- [ ] **Authorization matrix** includes every new action and route (accounts, system page, cron alerts, deep health, thin order/board routes with reasons).
- [ ] **Final full security pass** `docs/security/phase-6-review.md`: re-run the checklists from Phases 2–5, plus: backup key handling, S3 credentials scope, no secrets in the image or repo (grep for the demo secrets and any key-like strings), dependency audit (`npm audit --omit=dev`; record high/critical findings and fix or justify), security headers present on the production build, cookie flags, CSP decision recorded, error pages reveal nothing. **[HUMAN]:** run Strix against staging (needs Docker and an LLM key, only against the owner's own staging site with test data).
- [ ] Run `$ponytail-audit` over the whole repo; apply only findings that do not remove tests, validation, auth, audit logging, accessibility, transactions or business rules; otherwise list them in PROGRESS.
- [ ] Update `README.md` (run, test, env, scripts, docs index).
- [ ] Full lint, typecheck, unit, integration, e2e, and the load test once more. All green.
- [ ] Consolidate `docs/HUMAN-TODO.md`: group by phase, order by what blocks the pilot, each item with the exact command or click path and who does it. Add the top 5 morning actions at the top.
- [ ] Write the **Phase 6 summary** and a **final report** at the end of `docs/PROGRESS.md`: what is built, test counts, every Deviation in one list, every HUMAN item, known limitations, and recommended next steps (multi-restaurant, online payments, official WhatsApp API).
