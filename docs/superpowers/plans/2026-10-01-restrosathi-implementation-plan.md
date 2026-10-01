# RestroSathi Prototype Implementation Plan

> **For agentic workers (Codex or similar):** Follow `AGENTS.md`. Implement tasks in order, and tick each step's checkbox (`- [ ]` → `- [x]`) as you finish it. Ticking checkboxes is the only edit allowed to this file. One commit per task. In single-task mode, stop after the commit; in continuous mode, carry on to the next task and stop only at the end of the phase or at an `AGENTS.md` stop condition.

**Goal:** Build a single-restaurant website, QR ordering, kitchen board and billing system (plus bookings, WhatsApp and growth features) for the fictional demo restaurant "Saffron Tadka", delivered in 7 phases.

**Architecture:** One Next.js App Router app (TypeScript) with server actions over PostgreSQL via Prisma. Each `src/lib/<area>/` module owns its rules and tables. WA-AKG runs as a separate internal Docker service from Phase 4. Everything is deployed with Docker Compose on one VPS behind Caddy.

**Tech Stack:** Node.js 22 LTS, Next.js (latest stable), React, Tailwind CSS v4, shadcn/ui, Motion, next-intl, Prisma + PostgreSQL 17, Zod, sharp, Vitest, Playwright, @axe-core/playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-restrosathi-prototype-design.md` (v2)

**How this plan is organised:** Part A is the roadmap for **all phases** (scope, tasks, exit criteria). Part B gives **step-by-step tasks for Phases 0 and 1**. Each later phase gets its own detailed plan, written just before that phase starts, so it can use what we learn while building.

## Global Constraints

- Node.js 22 LTS, npm, TypeScript `strict: true`.
- Allowed runtime dependencies in Phases 0–1: `next`, `react`, `react-dom`, `tailwindcss` (v4), shadcn/ui (Radix-based components it generates), `motion`, `next-intl`, `@prisma/client`, `zod`, `sharp`. Dev: `prisma`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`. Any other dependency needs a one-line reason in its commit message.
- Money is always **integer paise**. Display only through `formatINR(paise)`.
- Times are stored in UTC and displayed in `Asia/Kolkata`.
- Localized DB text is `{ en: string; hi?: string }`. UI strings live only in `messages/en.json` and `messages/hi.json`, and every `en` key exists in `hi`.
- Colours, spacing, radius and motion come only from tokens in `src/brand/theme.css`; no raw hex anywhere else.
- WCAG 2.2 AA; touch targets ≥ 44 px; `<html lang>` equals the active locale; motion disabled under `prefers-reduced-motion`.
- `/menu` (and later `/t/[code]`): ≤ 150 KB gzipped JS transferred on first load; no horizontal scroll at 360 px.
- Every server action and mutating route handler calls `requireUser()` unless the plan marks it public.
- The server recomputes every price; client-sent prices are ignored.
- Features from later phases are hidden through `FEATURES` in `src/lib/features.ts`.
- Demo brand name: **Saffron Tadka**.

## Review Focus

1. **Missing Hindi text**: an item or setting without `hi` must show English, never blank or `undefined` (tests in Task 3 and Task 6).
2. **Long Hindi names at 360 px**: no horizontal scroll on `/menu` (test in Task 6).
3. **Bad photo uploads** (HEIC, > 5 MB, a text file renamed `.jpg`): rejected with a clear message, no crash (tests in Task 9).
4. **Overnight opening hours** such as 18:00–01:00: accepted by settings and emitted correctly in JSON-LD (tests in Task 7 and Task 8).
5. **Invalid menu structure** (an item with neither a base price nor variants, or deleting a category that still has items): blocked with a message (tests in Task 5 and Task 9).

---

# Part A: Phase roadmap

Each phase ends with something that runs end to end and can be demoed. "Exit criteria" must all pass before the next phase starts.

## Phase 0: Foundation (Tasks 1–4, detailed in Part B)
App skeleton, brand tokens, CI, Postgres + Prisma, Settings, audit log, i18n (en/hi), auth (owner password + staff PIN).
**Exit:** CI green; `/admin` requires login; language toggle switches `<html lang>`; seed creates Saffron Tadka settings, an owner and one staff user.

## Phase 1: Menu + public website (Tasks 5–10, detailed in Part B)
Menu model with variants and add-ons, pricing rules, public menu page, home page + SEO, settings editor, menu editor with sold-out switch and photo upload, accessibility and performance gates.
**Exit:** owner edits the menu and settings without touching code; `/menu` passes axe with zero serious violations and meets the 150 KB budget; sold-out changes show immediately.

## Phase 2: QR ordering + kitchen board (sell-able demo)
- Task 11: Tables, random codes, "regenerate code", printable QR sheet.
- Task 12: Dining sessions with a partial unique index (one non-closed session per table); opened by the first order.
- Task 13: Order placement: idempotency key, transactional availability + price recompute, rate limits per session/device with a loose IP cap.
- Task 14: Order state machine (`NEW → PREPARING → READY → SERVED`, `NEW → REJECTED` with reason) and line voids, with audit.
- Task 15: Table page `/t/[code]`: variant/add-on sheet, cart, status tracker, Call waiter, Request bill, bill view with amount only.
- Task 16: Staff board: 3 s polling, Start shift (audio unlock + Wake Lock), new-order sound, 2-minute escalation alarm, "last updated" banner, `aria-live`, kitchen view filter.
- Task 17: KOT print (80 mm CSS).
- Task 18: AI menu assistant: `src/lib/ai`, allergy keyword pre-check, grounded structured output, per-device daily limit, atomic monthly cap, Hindi/English/Hinglish eval set.
- Task 19: First VPS deploy: Dockerfile, production Compose (`app`, `postgres`, `caddy`), env secrets, nightly local `pg_dump`.

**Exit:** E2E: scan → order → accept → ready → served in under 5 s per hop; a duplicate submit creates one order; a second session cannot open on a busy table; demo URL live over HTTPS.

## Phase 3: Billing
- Task 20: Staff-entered orders for a table or a **takeaway** session (start in `PREPARING`).
- Task 21: Billing engine (pure functions): tax modes `NONE` / `COMPOSITION` / `REGULAR`, prices with or without tax, discount (flat or %), CGST/SGST split, round-off.
- Task 22: Generate bill with line and tax snapshots.
- Task 23: Invoice numbers `2026-27/0001` per financial year + settlement with one or more payments (Cash / UPI / Card) summing to the total, inside one transaction; concurrency test.
- Task 24: Cancel settled bill (owner, reason, number kept) + audit.
- Task 25: 80 mm bill print with GSTIN (REGULAR) and FSSAI number.
- Task 26: Day-end report (Asia/Kolkata day).
- Task 27: Customer bill view reads the bill snapshot.

**Exit:** E2E dine-in cycle ends with a printed, settled bill and a free table; takeaway bill without any QR; day-end totals equal the sum of settled bills to the paisa; two staff settling the same bill at once produce exactly one settlement.

## Phase 4: WhatsApp, OTP, bookings, events
- Task 28: WA-AKG in Compose (internal network) + `src/lib/whatsapp` adapter + webhook (constant-time secret, dedupe by message id, ignore groups/broadcasts, pause AI for 12 h after a human reply).
- Task 29: `notify(kind, to, params)` outbox + cron sender (5 retries with backoff) + "WhatsApp disconnected" banner.
- Task 30: Phone normalisation to E.164 + OTP (6 digits, 10 min, 5 attempts, 3 sends/hour, hashed, 180-day verified-device cookie).
- Task 31: Booking rules + request form (covers per slot, 90-min occupancy, blocked dates, 60-min cutoff, max party size, one request per phone per slot).
- Task 32: Staff booking screen; confirm with `SELECT … FOR UPDATE` re-check; reminders 3 h before; customer cancel link.
- Task 33: Event packages + enquiries.
- Task 34: Grounded AI auto-reply + `needsHuman`.
- Task 35: Order escalation WhatsApp to the owner (extends Task 16).
- Task 36: Privacy page; enable `FEATURES.bookings` and `FEATURES.events`.

**Exit:** E2E booking request → OTP → staff confirm → confirmation queued; concurrent confirms never exceed capacity; WA-AKG down → bookings still saved and messages retried.

## Phase 5: Customers + growth
- Task 37: Customers + consent records.
- Task 38: Loyalty ledger: earn on settlement for verified phones, redeem in billing, reverse on cancellation.
- Task 39: Feedback link (7-day token) + Google review link for everyone + feedback QR printed on bills without a phone.
- Task 40: Owner dashboard.
- Task 41: AI feedback themes + draft review replies.
- Task 42: Monday 09:00 IST weekly report to the owner via WhatsApp.
- Task 43: AI marketing drafts → per-customer wa.me links (consented customers only).

**Exit:** points balance always equals the ledger sum; double redemption impossible under concurrency; opted-out customers never appear in marketing lists.

## Phase 6: Go-live hardening + pilot
- Task 44: Off-site encrypted backups (database, uploads, WA-AKG session) + documented restore drill.
- Task 45: Monitoring: uptime check, error tracking, disk and backup alerts.
- Task 46: Load test: 20 tables ordering + 3 staff boards polling.
- Task 47: Real-device QA on a low-end Android over 4G + pilot checklist with the first restaurant.

**Exit:** restore drill completed on a fresh VPS; load test p95 order placement < 1 s; pilot checklist signed off.

---

# Part B: Phases 0 and 1 in detail

## File structure (Phases 0–1)

```
docker-compose.yml               dev Postgres (dbs: restrosathi, restrosathi_test)
docker/postgres-init.sql         creates restrosathi_test
prisma/schema.prisma             all models
prisma/seed.ts                   Saffron Tadka settings, users, menu
messages/en.json, hi.json        UI strings
src/brand/theme.css              design tokens (the only place with colour values)
src/app/globals.css              Tailwind import + theme mapping
src/app/layout.tsx               <html lang>, NextIntlClientProvider
src/app/(public)/layout.tsx      header, nav, footer, LanguageToggle, FloatingContact
src/app/(public)/page.tsx        home
src/app/(public)/menu/page.tsx   public menu (dynamic)
src/app/login/…                  owner password login, staff PIN login
src/app/admin/…                  guarded admin: settings, menu
src/app/uploads/[...path]/route.ts  serves uploaded images from UPLOAD_DIR
src/i18n/request.ts              next-intl config (cookie locale)
src/lib/db.ts                    Prisma client singleton
src/lib/money/format.ts          formatINR
src/lib/i18n/l10n.ts             L10n type, schema, localize
src/lib/settings/{index,schema}.ts
src/lib/audit/index.ts
src/lib/auth/{password,session,rate-limit}.ts
src/lib/menu/{schemas,pricing,queries,filter,images}.ts
src/lib/seo/jsonld.ts
src/lib/features.ts
tests/setup/db.ts                integration-test DB reset
tests/e2e/*.spec.ts
.github/workflows/ci.yml
```

Test naming: `*.test.ts` = unit (no DB); `*.int.test.ts` = integration (test DB); `tests/e2e/*.spec.ts` = Playwright.

---

### Task 1: App skeleton, brand tokens, money formatting, CI

**Files:**
- Create (via `create-next-app`): `package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `tsconfig.json`, `next.config.ts`
- Create: `.nvmrc` (`22`), `src/brand/theme.css`, `src/lib/money/format.ts`, `src/lib/money/format.test.ts`, `vitest.config.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `.env.example`

**Interfaces:**
- Produces: `formatINR(paise: number): string`; npm scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test:unit`, `test:int`, `test:e2e`; CSS variables `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-contrast`, `--color-accent`, `--color-veg`, `--color-nonveg`, `--color-danger`, `--color-focus`, `--radius-sm|md|lg`, `--duration-fast` (150ms), `--duration-base` (250ms), font families `--font-display`, `--font-body`.

- [ ] **Step 0: Protect existing files.** Run `git status`; it must be clean (the repo already has `.gitattributes` with `* text=auto eol=lf` so Windows doesn't rewrite line endings). Then scaffold. After scaffolding, run `git status` again. If `AGENTS.md`, `PRODUCT.md` or any file under `docs/` was changed or overwritten, restore it with `git checkout -- <file>`.

- [ ] **Step 1: Scaffold**

Run in the repo root: `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`, then `npx shadcn@latest init`, `npm i motion zod`, `npm i -D vitest @playwright/test tsx` and `npx playwright install chromium`.
Expected: `npm run dev` serves the default page.

- [ ] **Step 2: Write the failing unit test** `src/lib/money/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatINR } from "./format";

describe("formatINR", () => {
  it("formats paise as rupees with Indian grouping", () => {
    expect(formatINR(12345650)).toBe("₹1,23,456.50");
  });
  it("formats zero", () => expect(formatINR(0)).toBe("₹0.00"));
  it("rejects non-integer paise", () => expect(() => formatINR(10.5)).toThrow());
});
```

- [ ] **Step 3: Run it**: `npm run test:unit`. Expected: FAIL (`formatINR` not found).

- [ ] **Step 4: Implement `formatINR(paise: number): string`** using `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`; throw `RangeError` when `!Number.isInteger(paise)`.

- [ ] **Step 5: Run it**: `npm run test:unit`. Expected: PASS.

- [ ] **Step 6: Tokens + smoke E2E**

Define the tokens above in `src/brand/theme.css` (warm, food-friendly palette; text on surface ≥ 4.5:1). Map them in `globals.css` with Tailwind v4 `@theme inline`. Set `body` background to `var(--color-surface)` and add a global `:focus-visible` outline using `--color-focus`, plus a `prefers-reduced-motion` rule that zeroes the durations. Write `tests/e2e/smoke.spec.ts`:

```ts
test("home renders with brand tokens", async ({ page }) => {
  await page.goto("/");
  const surface = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim());
  expect(surface).not.toBe("");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
```

`playwright.config.ts`: `webServer: { command: "npm run build && npm run start", port: 3000 }`, projects `mobile` (viewport 360×740) and `desktop`.
Run: `npm run test:e2e`. Expected: PASS.

- [ ] **Step 7: CI** `.github/workflows/ci.yml` on push: Node 22, `npm ci`, `lint`, `typecheck`, `test:unit`, `test:e2e` (the Postgres service and `test:int` are added in Task 2).

- [ ] **Step 8: Commit**: `git add -A && git commit -m "feat: app skeleton, brand tokens, formatINR, CI"`

---

### Task 2: Database, Settings, audit log

**Files:**
- Create: `docker-compose.yml`, `docker/postgres-init.sql`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`, `src/lib/settings/schema.ts`, `src/lib/settings/index.ts`, `src/lib/settings/settings.int.test.ts`, `src/lib/audit/index.ts`, `src/lib/audit/audit.int.test.ts`, `tests/setup/db.ts`
- Modify: `vitest.config.ts` (two projects), `.github/workflows/ci.yml` (Postgres 17 service + `test:int`), `.env.example` (`DATABASE_URL`, `TEST_DATABASE_URL`)

**Interfaces:**
- Consumes: `L10n` from Task 3 is **not** available yet, so define `Settings.about` as `Json` here and validate it with `l10nSchema` once Task 3 lands (Task 3 Step 6 edits this file).
- Produces:
  - `prisma` (singleton) from `src/lib/db.ts`
  - `hoursSchema`: `Record<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", Array<{ open: "HH:MM"; close: "HH:MM" }>>`; `close` earlier than `open` means the next day
  - `getSettings(): Promise<SettingsView>` where `SettingsView = { name: string; about: unknown; address: string; phone: string; whatsappPhone: string; mapEmbedUrl: string | null; googleReviewUrl: string | null; hours: Hours }`
  - `audit(entry: { actorId: string | null; action: string; entity: string; entityId: string; data?: unknown }): Promise<void>`
  - Prisma models `Settings` (id fixed `1`), `User`, `AuthSession`, `LoginAttempt`, `AuditLog` with fields from spec §11 (Phase 0 row)

- [ ] **Step 1: Write failing integration tests**

```ts
// settings.int.test.ts
it("returns the seeded restaurant", async () => {
  const s = await getSettings();
  expect(s.name).toBe("Saffron Tadka");
  expect(s.hours.mon[0]).toEqual({ open: "11:00", close: "23:00" });
});
it("rejects malformed hours", () => {
  expect(hoursSchema.safeParse({ mon: [{ open: "25:00", close: "23:00" }] }).success).toBe(false);
});
it("accepts overnight hours", () => {
  const all = Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map(d => [d, [{ open: "18:00", close: "01:00" }]]));
  expect(hoursSchema.safeParse(all).success).toBe(true);
});
// audit.int.test.ts
it("writes an audit row", async () => {
  await audit({ actorId: null, action: "test.action", entity: "Settings", entityId: "1", data: { a: 1 } });
  const row = await prisma.auditLog.findFirst({ where: { action: "test.action" } });
  expect(row?.data).toEqual({ a: 1 });
});
```

- [ ] **Step 2: Run**: `docker compose up -d && npm run test:int`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** the Compose file (Postgres 17, port 5432, init script creating `restrosathi_test`), the Phase 0 Prisma models, `src/lib/db.ts` (global-cached client), `hoursSchema`, `getSettings()` (reads row `1`, parses `hours` with `hoursSchema`, throws if the row is missing), `audit()`, and `prisma/seed.ts` (upsert Settings row `1` for Saffron Tadka, hours 11:00–23:00 daily, placeholder address and phone). `tests/setup/db.ts` is the Vitest `globalSetup` for the integration project: run `prisma db push --force-reset --skip-generate` against `TEST_DATABASE_URL`, then the seed. Integration project runs with `fileParallelism: false`.

- [ ] **Step 4: Run**: `npm run test:int`. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -am "feat: postgres, prisma, settings, audit log"` (add new files first).

---

### Task 3: Internationalisation (English / Hindi)

**Files:**
- Create: `src/i18n/request.ts`, `messages/en.json`, `messages/hi.json`, `src/lib/i18n/l10n.ts`, `src/lib/i18n/l10n.test.ts`, `src/lib/i18n/messages.test.ts`, `src/components/LanguageToggle.tsx`, `src/app/actions/locale.ts`, `tests/e2e/i18n.spec.ts`
- Modify: `next.config.ts` (next-intl plugin), `src/app/layout.tsx` (`<html lang={locale}>`, provider), `src/lib/settings/schema.ts` + `index.ts` (validate `about` with `l10nSchema`)

**Interfaces:**
- Produces: `type Locale = "en" | "hi"`; `type L10n = { en: string; hi?: string }`; `l10nSchema` (Zod; `en` non-empty); `localize(value: L10n, locale: Locale): string`; server action `setLocale(locale: Locale): Promise<void>` (public; sets cookie `NEXT_LOCALE`, 1 year); `<LanguageToggle />`. `SettingsView.about` becomes `L10n`.

- [ ] **Step 1: Write failing unit tests**

```ts
// l10n.test.ts
it("returns Hindi when present", () => expect(localize({ en: "Dal", hi: "दाल" }, "hi")).toBe("दाल"));
it("falls back to English when hi is missing", () => expect(localize({ en: "Dal" }, "hi")).toBe("Dal"));
it("falls back to English when hi is blank", () => expect(localize({ en: "Dal", hi: "  " }, "hi")).toBe("Dal"));
it("rejects empty English", () => expect(l10nSchema.safeParse({ en: "" }).success).toBe(false));
// messages.test.ts — every English key exists in Hindi, recursively
it("hi.json has every key of en.json", () => expect(missingKeys(en, hi)).toEqual([]));
```

`missingKeys` is a small helper inside the test file that walks nested objects.

- [ ] **Step 2: Run**: `npm run test:unit`. Expected: FAIL.

- [ ] **Step 3: Implement** `l10n.ts`; `src/i18n/request.ts` with next-intl's "without i18n routing" setup: the locale comes from cookie `NEXT_LOCALE`, defaults to `en`, and anything else falls back to `en`. Add messages for `nav.*`, `home.*`, `menu.*`, `common.*` in both files; Hindi strings are real Hindi, not transliteration.

- [ ] **Step 4: Run unit tests.** Expected: PASS.

- [ ] **Step 5: E2E** `tests/e2e/i18n.spec.ts`

```ts
test("language toggle switches to Hindi and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi"); // persisted
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
```

Run: `npm run test:e2e -- i18n`. Expected: PASS.

- [ ] **Step 6: Validate `Settings.about`** with `l10nSchema` in `getSettings()`; add an assertion to `settings.int.test.ts`: `expect(s.about.en.length).toBeGreaterThan(0)`. Seed `about` with en + hi text. Run `npm run test:int`. Expected: PASS.

- [ ] **Step 7: Commit**: `git commit -m "feat: en/hi i18n with cookie locale and L10n helper"`

---

### Task 4: Authentication: owner password, staff PIN, guarded admin

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/password.test.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rate-limit.ts`, `src/lib/auth/auth.int.test.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/login/staff/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `tests/e2e/auth.spec.ts`, `tests/helpers/auth.ts`
- Modify: `prisma/seed.ts` (owner `+919999900001` with password from env `SEED_OWNER_PASSWORD`; staff "Ravi" with PIN from `SEED_STAFF_PIN`), `.env.example`

**Interfaces:**
- Produces:
  - `hashSecret(secret: string): Promise<string>` (format `scrypt$<saltB64>$<hashB64>`, `crypto.scrypt`, 16-byte salt, 64-byte key) and `verifySecret(secret: string, stored: string): Promise<boolean>` (`timingSafeEqual`)
  - `createSession(userId: string): Promise<void>` sets cookie `rs_session` (32 random bytes base64url; DB stores SHA-256 of the token; httpOnly, `sameSite: "lax"`, `secure` in production, expires in 12 h)
  - `getCurrentUser(): Promise<{ id: string; name: string; role: "OWNER" | "STAFF" } | null>` (null when missing, unknown, expired or `active = false`)
  - `requireUser(role?: "OWNER" | "STAFF"): Promise<CurrentUser>` throws `AuthError` (exported class) when not logged in or when `role === "OWNER"` and the user is staff (`"STAFF"` means any logged-in user)
  - `requirePageUser(role?)`: same check, but redirects to `/login`
  - `destroySession(): Promise<void>`
  - `isLockedOut(keys: string[]): Promise<boolean>`; `recordFailure(keys: string[]): Promise<void>` (5 failures within 15 min on any key = locked; keys like `user:<id>` and `ip:<ip>`)
  - Server actions (public): `loginWithPassword(form: { phone: string; password: string })`, `loginWithPin(form: { userId: string; pin: string })`. Both return `{ error: "invalid" | "locked" } | void` and redirect to `/admin` on success. `logout()` requires a user.
  - Test helpers in `tests/helpers/auth.ts`: `mockCookies()` (installs the in-memory `next/headers` mock), `asOwner(): Promise<void>`, `asStaff(): Promise<void>`, `asAnonymous(): void`. These create a real `AuthSession` for the seeded user and put its token in the mock jar. Every later integration test uses them.

- [ ] **Step 1: Failing tests**

```ts
// password.test.ts
it("verifies the right secret", async () => expect(await verifySecret("s3cret!", await hashSecret("s3cret!"))).toBe(true));
it("rejects the wrong secret", async () => expect(await verifySecret("nope", await hashSecret("s3cret!"))).toBe(false));
it("salts hashes", async () => expect(await hashSecret("x")).not.toBe(await hashSecret("x")));
// auth.int.test.ts
it("locks out after 5 failures even with the right password next", async () => {
  for (let i = 0; i < 5; i++) await recordFailure(["user:owner-test"]);
  expect(await isLockedOut(["user:owner-test"])).toBe(true);
});
it("treats an expired session as logged out", async () => { /* insert AuthSession expiresAt in the past; getCurrentUser() with that cookie → null */ });
it("requireUser('OWNER') rejects staff", async () => { /* staff session → await expect(requireUser("OWNER")).rejects.toBeInstanceOf(AuthError) */ });
```

Cookie access in integration tests: mock `next/headers` `cookies()` with a small in-memory jar via `vi.mock`.

- [ ] **Step 2: Run** unit + integration. Expected: FAIL.

- [ ] **Step 3: Implement** the interfaces above. Pages: `/login` (phone + password), `/login/staff` (pick an active staff name, then a 4–6 digit PIN on a large keypad with ≥ 44 px keys). `/admin/layout.tsx` calls `requirePageUser()` and shows the user's name, role and a Logout button.

- [ ] **Step 4: Run** unit + integration. Expected: PASS.

- [ ] **Step 5: E2E** `tests/e2e/auth.spec.ts`: anonymous `/admin` redirects to `/login`; the owner logs in and sees "Owner"; staff PIN login shows "Ravi"; a wrong PIN shows the `invalid` message; Logout returns to `/login`. Run: `npm run test:e2e -- auth`. Expected: PASS.

- [ ] **Step 6: Commit**: `git commit -m "feat: owner password and staff PIN auth with DB sessions and lockout"`

**Phase 0 exit check:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:int && npm run test:e2e` all pass; CI green.

---

### Task 5: Menu model and pricing rules

**Files:**
- Modify: `prisma/schema.prisma` (Phase 1 models from spec §11), `prisma/seed.ts`
- Create: `src/lib/menu/schemas.ts`, `src/lib/menu/schemas.test.ts`, `src/lib/menu/pricing.ts`, `src/lib/menu/pricing.test.ts`, `src/lib/menu/queries.ts`, `src/lib/menu/queries.int.test.ts`

**Interfaces:**
- Consumes: `L10n`, `l10nSchema` (Task 3); `prisma` (Task 2).
- Produces:
  - `itemInputSchema` (Zod): `{ categoryId, name: L10n, description?: L10n, basePricePaise?: int > 0, variants: { name: L10n, pricePaise: int > 0 }[], modifierGroups: { name: L10n, min: int ≥ 0, max: int ≥ min, options: { name: L10n, priceDeltaPaise: int ≥ 0 }[] (≥ 1) }[], isVeg: boolean, spiceLevel: 0..3, tags: ("BESTSELLER"|"CHEFS_SPECIAL"|"NEW")[], available: boolean }`, refined so that **exactly one** of `basePricePaise` and a non-empty `variants` is set
  - `type PricingItem = { basePricePaise: number | null; variants: { id: string; pricePaise: number }[]; modifierGroups: { id: string; min: number; max: number; options: { id: string; priceDeltaPaise: number }[] }[] }`
  - `priceLine(item: PricingItem, choice: { variantId?: string; optionIds: string[] }): number` returns unit price in paise; throws `MenuChoiceError` with `.code` in `"VARIANT_REQUIRED" | "UNKNOWN_VARIANT" | "UNKNOWN_OPTION" | "GROUP_MIN" | "GROUP_MAX"`
  - `getPublicMenu(): Promise<PublicMenu>` where `PublicMenu = { categories: { id: string; name: L10n; items: PublicItem[] }[] }`; `PublicItem` contains item fields, variants, modifier groups with options, `available`, and `photoUrl`, all ordered by `sortOrder`. Includes sold-out items; omits empty categories.

- [ ] **Step 1: Failing tests**

```ts
// pricing.test.ts — fixture: dal (variants Half 18000 / Full 32000), naan (base 6000; group Extras min0 max2: butter +1000, cheese +3000), tikka (base 28000; group Spice min1 max1: mild 0, hot 0)
it("uses base price", () => expect(priceLine(naan, { optionIds: [] })).toBe(6000));
it("adds option deltas", () => expect(priceLine(naan, { optionIds: ["butter", "cheese"] })).toBe(10000));
it("uses variant price", () => expect(priceLine(dal, { variantId: "half", optionIds: [] })).toBe(18000));
it("requires a variant when the item has variants", () =>
  expect(() => priceLine(dal, { optionIds: [] })).toThrow(expect.objectContaining({ code: "VARIANT_REQUIRED" })));
it("enforces group min", () =>
  expect(() => priceLine(tikka, { optionIds: [] })).toThrow(expect.objectContaining({ code: "GROUP_MIN" })));
it("enforces group max", () =>
  expect(() => priceLine(tikka, { optionIds: ["mild", "hot"] })).toThrow(expect.objectContaining({ code: "GROUP_MAX" })));
it("rejects options from another item", () =>
  expect(() => priceLine(naan, { optionIds: ["mild"] })).toThrow(expect.objectContaining({ code: "UNKNOWN_OPTION" })));
// schemas.test.ts
it("rejects an item with neither base price nor variants", () => expect(itemInputSchema.safeParse(noPrice).success).toBe(false));
it("rejects an item with both", () => expect(itemInputSchema.safeParse(both).success).toBe(false));
it("rejects zero price", () => expect(itemInputSchema.safeParse({ ...naanInput, basePricePaise: 0 }).success).toBe(false));
// queries.int.test.ts
it("returns seeded categories in order with sold-out items flagged", async () => {
  const m = await getPublicMenu();
  expect(m.categories[0].name.en).toBe("Starters");
  expect(m.categories.flatMap(c => c.items).find(i => i.name.en === "Mutton Rogan Josh")?.available).toBe(false);
});
```

- [ ] **Step 2: Run** unit + integration. Expected: FAIL.

- [ ] **Step 3: Implement** the models, schemas, `priceLine`, `getPublicMenu`. Seed about 20 Saffron Tadka dishes across Starters, Main Course, Breads, Rice, Desserts, Beverages, with Hindi names, at least: Dal Makhani (Half/Full), Butter Naan (Extras group), Paneer Tikka (Spice group, min 1), Butter Chicken (non-veg), Mutton Rogan Josh (`available: false`), one dish with **no Hindi name**, and one with a long Hindi name (≥ 40 characters).

- [ ] **Step 4: Run** unit + integration. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "feat: menu model with variants, add-ons and server-side pricing"`

---

### Task 6: Public menu page

**Files:**
- Create: `src/lib/menu/filter.ts`, `src/lib/menu/filter.test.ts`, `src/app/(public)/layout.tsx`, `src/app/(public)/menu/page.tsx`, `src/components/menu/MenuView.tsx`, `src/components/menu/DishCard.tsx`, `tests/e2e/menu.spec.ts`

**Interfaces:**
- Consumes: `getPublicMenu`, `PublicMenu` (Task 5); `localize`, `Locale` (Task 3); `formatINR` (Task 1).
- Produces: `filterMenu(menu: PublicMenu, f: { query: string; vegOnly: boolean }): PublicMenu` (query matches `name.en`, `name.hi`, case-insensitive, trimmed; drops empty categories); `<DishCard item locale />` (reused in Phase 2 with an Add button) whose root has `data-testid={"dish-" + item.name.en}`.

- [ ] **Step 1: Failing unit tests**

```ts
it("vegOnly removes non-veg dishes", () => expect(names(filterMenu(menu, { query: "", vegOnly: true }))).not.toContain("Butter Chicken"));
it("matches Hindi names", () => expect(names(filterMenu(menu, { query: "दाल", vegOnly: false }))).toEqual(["Dal Makhani"]));
it("matches English case-insensitively", () => expect(names(filterMenu(menu, { query: "  NAAN ", vegOnly: false }))).toEqual(["Butter Naan"]));
it("drops empty categories", () => expect(filterMenu(menu, { query: "naan", vegOnly: false }).categories).toHaveLength(1));
```

- [ ] **Step 2: Run** `npm run test:unit`. Expected: FAIL.

- [ ] **Step 3: Implement** `filterMenu`; `/menu` as a dynamic server component (`export const dynamic = "force-dynamic"`) passing `getPublicMenu()` to the client `MenuView`: sticky category tabs (scroll-spy), search field, veg-only switch, dish cards with veg/non-veg mark (shape **and** colour, not colour alone), spice level, tags, photo (`next/image`, lazy below the fold), prices (`Half ₹180.00 · Full ₹320.00` for variants) and a "Sold out" badge. View-only: no Add button. `(public)/layout.tsx` holds the header with logo, nav (`Home`, `Menu`), and `LanguageToggle`.

- [ ] **Step 4: Run** unit. Expected: PASS.

- [ ] **Step 5: E2E** `tests/e2e/menu.spec.ts`

```ts
test("menu shows prices, filters veg, shows sold out", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.getByText("Dal Makhani")).toBeVisible();
  await expect(page.getByText("₹180.00")).toBeVisible();
  await page.getByRole("switch", { name: /veg/i }).click();
  await expect(page.getByText("Butter Chicken")).toHaveCount(0);
  await page.getByRole("switch", { name: /veg/i }).click();
  await expect(page.getByTestId("dish-Mutton Rogan Josh").getByText("Sold out")).toBeVisible();
});
test("Hindi names with English fallback, no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "hi", url: "http://localhost:3000" }]);
  await page.goto("/menu");
  await expect(page.getByText("दाल मखनी")).toBeVisible();
  await expect(page.getByTestId(/dish-/).filter({ hasText: "undefined" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
```

Run: `npm run test:e2e -- menu`. Expected: PASS.

- [ ] **Step 6: Commit**: `git commit -m "feat: public menu page with search, veg filter and Hindi"`

---

### Task 7: Home page, SEO and feature flags

**Files:**
- Create: `src/lib/features.ts`, `src/lib/seo/jsonld.ts`, `src/lib/seo/jsonld.test.ts`, `src/app/(public)/page.tsx`, `src/components/home/Hero.tsx`, `src/components/home/SignatureDishes.tsx`, `src/components/home/HoursAndMap.tsx`, `src/components/FloatingContact.tsx`, `tests/e2e/home.spec.ts`
- Modify: `src/app/(public)/layout.tsx` (nav driven by `FEATURES`; footer with hours), `src/app/layout.tsx` (default metadata from Settings via `generateMetadata`)

**Interfaces:**
- Consumes: `getSettings`, `Hours` (Task 2); `getPublicMenu` (Task 5); `localize` (Task 3).
- Produces: `FEATURES = { bookings: false, events: false } as const`; `restaurantJsonLd(s: SettingsView, siteUrl: string): Record<string, unknown>`; `whatsappChatUrl(phoneE164: string, text?: string): string` (in `FloatingContact.tsx` or `src/lib/seo`; reused in Phase 5) returning `https://wa.me/<digits>?text=<encoded>`.

- [ ] **Step 1: Failing unit tests**

```ts
it("builds Restaurant JSON-LD", () => {
  const j = restaurantJsonLd(settings, "https://saffrontadka.example");
  expect(j["@type"]).toBe("Restaurant");
  expect(j.name).toBe("Saffron Tadka");
  expect(j.menu).toBe("https://saffrontadka.example/menu");
});
it("emits overnight hours as given", () => {
  const j = restaurantJsonLd({ ...settings, hours: allDays([{ open: "18:00", close: "01:00" }]) }, url);
  expect(j.openingHoursSpecification).toContainEqual(expect.objectContaining({ dayOfWeek: "https://schema.org/Monday", opens: "18:00", closes: "01:00" }));
});
it("builds a wa.me link", () => expect(whatsappChatUrl("+919876543210", "Hi")).toBe("https://wa.me/919876543210?text=Hi"));
```

- [ ] **Step 2: Run** unit. Expected: FAIL.

- [ ] **Step 3: Implement** the interfaces; the home page: hero (full-bleed photo from `public/brand/hero.webp`; commit a placeholder food photo you own or that is free to use, ≤ 200 KB WebP; name, about text, CTA "View menu", plus "Book a table" / "Plan an event" only when the matching `FEATURES` flag is true), signature dishes (items tagged `CHEFS_SPECIAL`, max 6), hours + Google Maps iframe (only if `mapEmbedUrl`) + Google review link (only if `googleReviewUrl`), floating Call (`tel:`) and WhatsApp-chat buttons. Entrance motion via `motion` with token durations; none under reduced motion. JSON-LD in a `<script type="application/ld+json">`.

- [ ] **Step 4: Run** unit. Expected: PASS.

- [ ] **Step 5: E2E** `tests/e2e/home.spec.ts`: home shows "Saffron Tadka"; "View menu" navigates to `/menu`; no link named "Book a table" exists; a JSON-LD script parses with `name === "Saffron Tadka"`; the WhatsApp button `href` starts with `https://wa.me/91`. Run: `npm run test:e2e -- home`. Expected: PASS.

- [ ] **Step 6: Commit**: `git commit -m "feat: home page, Restaurant JSON-LD, feature flags"`

---

### Task 8: Settings editor (owner)

**Files:**
- Create: `src/app/admin/settings/page.tsx`, `src/app/admin/settings/actions.ts`, `src/lib/settings/update.int.test.ts`
- Modify: `src/lib/settings/schema.ts` (`settingsInputSchema`), `src/lib/settings/index.ts` (`updateSettings`)

**Interfaces:**
- Consumes: `requireUser`, `AuthError` (Task 4); `audit` (Task 2); `hoursSchema`, `l10nSchema`.
- Produces: `settingsInputSchema` (name 1–80 chars, `about: L10n`, address, `phone` and `whatsappPhone` as `+91` + 10 digits, optional `https://` URLs for map and reviews, `hours`); server action `updateSettings(input: unknown): Promise<{ ok: true } | { ok: false; fieldErrors: Record<string, string[]> }>` (OWNER only; writes `audit({ action: "settings.update", entity: "Settings", entityId: "1", data: { before, after } })`).

- [ ] **Step 1: Failing integration tests**: staff session → `updateSettings(valid)` rejects with `AuthError`; owner → valid input persists and creates one `settings.update` audit row; owner → `hours.mon[0].open = "25:00"` returns `{ ok: false }` with a `hours` field error; overnight `18:00–01:00` saves.
- [ ] **Step 2: Run** `npm run test:int`. Expected: FAIL.
- [ ] **Step 3: Implement** the action and the page: grouped form (Basics, About in English + Hindi side by side, Contact, Links, Hours per day with "Closed" and "Add second shift"), inline field errors announced via `aria-live`, and a "Saved" toast.
- [ ] **Step 4: Run** `npm run test:int`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: owner settings editor with audit"`

---

### Task 9: Menu editor, sold-out switch, photo upload

**Files:**
- Create: `src/lib/menu/images.ts`, `src/lib/menu/images.int.test.ts`, `src/lib/menu/mutations.ts`, `src/lib/menu/mutations.int.test.ts`, `src/app/admin/menu/page.tsx`, `src/app/admin/menu/[itemId]/page.tsx`, `src/app/admin/menu/actions.ts`, `src/app/uploads/[...path]/route.ts`, `tests/e2e/menu-admin.spec.ts`, `src/lib/menu/__fixtures__/` (tiny PNG, fake.jpg text file, 6 MB file generated in the test)
- Modify: `.env.example` (`UPLOAD_DIR=./uploads`), `.gitignore` (`uploads/`)

**Interfaces:**
- Consumes: `itemInputSchema` (Task 5); `requireUser` (Task 4); `audit` (Task 2).
- Produces:
  - `processMenuPhoto(file: File): Promise<string>`: accepts only JPEG/PNG/WebP by **content** (sharp metadata), max 5 MB; resizes to max 1200 px wide; encodes WebP quality 80 (sharp drops EXIF by default); saves `${UPLOAD_DIR}/menu/<uuid>.webp`; returns `/uploads/menu/<uuid>.webp`. Throws `UploadError` with `.code` `"TOO_LARGE" | "UNSUPPORTED_TYPE"`.
  - Actions: `upsertCategory`, `deleteCategory(id)` (OWNER; throws `MenuEditError("CATEGORY_NOT_EMPTY")` if it has items), `upsertItem(input)` (OWNER; validates with `itemInputSchema`; replaces variants and groups in one transaction; audits `menu.price_change` with before/after prices when any price changes), `setItemAvailability(id, available)` (STAFF or OWNER; audits `menu.availability`), `deleteItem(id)` (OWNER), `uploadMenuPhoto(formData)` (OWNER).
  - Route `GET /uploads/[...path]`: serves files under `UPLOAD_DIR` only (rejects `..`), with `Cache-Control: public, max-age=31536000, immutable`.

- [ ] **Step 1: Failing integration tests**

```ts
it("staff cannot edit items", async () => { asStaff(); await expect(upsertItem(validItem)).rejects.toBeInstanceOf(AuthError); });
it("staff can mark sold out", async () => { asStaff(); await setItemAvailability(dalId, false); expect((await prisma.menuItem.findUniqueOrThrow({ where: { id: dalId } })).available).toBe(false); });
it("audits price changes", async () => {
  asOwner(); await upsertItem({ ...naan, basePricePaise: 7000 });
  const row = await prisma.auditLog.findFirst({ where: { action: "menu.price_change" }, orderBy: { at: "desc" } });
  expect(row?.data).toMatchObject({ before: { basePricePaise: 6000 }, after: { basePricePaise: 7000 } });
});
it("blocks deleting a non-empty category", async () => {
  asOwner(); await expect(deleteCategory(startersId)).rejects.toMatchObject({ code: "CATEGORY_NOT_EMPTY" });
});
// images.int.test.ts
it("rejects files over 5 MB", async () => await expect(processMenuPhoto(bigFile)).rejects.toMatchObject({ code: "TOO_LARGE" }));
it("rejects a text file named .jpg", async () => await expect(processMenuPhoto(fakeJpg)).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" }));
it("rejects HEIC", async () => await expect(processMenuPhoto(heicLike)).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" }));
it("stores a WebP without EXIF", async () => {
  const url = await processMenuPhoto(pngWithExif);
  const meta = await sharp(path.join(process.env.UPLOAD_DIR!, url.replace("/uploads/", ""))).metadata();
  expect(meta.format).toBe("webp"); expect(meta.exif).toBeUndefined();
});
```

`heicLike` is a buffer starting with the `ftypheic` box (no real HEIC needed).

- [ ] **Step 2: Run** `npm run test:int`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces. Admin UI: `/admin/menu` lists categories and items with a large sold-out switch per item (usable by staff), reorder by up/down buttons, "Add item"; `/admin/menu/[itemId]` (owner) edits names (en + hi), description, price **or** variants (toggle), modifier groups with options, veg, spice, tags, photo (preview, error messages per `UploadError.code` in both languages), with "Goes well with" pairings deferred to Phase 2 Task 15.
- [ ] **Step 4: Run** `npm run test:int`. Expected: PASS.
- [ ] **Step 5: E2E** `tests/e2e/menu-admin.spec.ts`: staff logs in, switches "Paneer Tikka" to sold out; a new page on `/menu` shows its "Sold out" badge; switching back removes it. Run: `npm run test:e2e -- menu-admin`. Expected: PASS.
- [ ] **Step 6: Commit**: `git commit -m "feat: menu editor, sold-out switch, safe photo uploads"`

---

### Task 10: Accessibility, performance and Hindi layout gates

**Files:**
- Create: `tests/e2e/a11y.spec.ts`, `tests/e2e/perf.spec.ts`, `tests/e2e/visual.spec.ts`
- Modify: `package.json` (`npm i -D @axe-core/playwright`), `.github/workflows/ci.yml` (upload Playwright report on failure)

**Interfaces:**
- Consumes: pages from Tasks 4–9.
- Produces: CI gates that later phases extend with `/t/[code]` and admin pages.

- [ ] **Step 1: Write the gates**

```ts
// a11y.spec.ts — for "/", "/menu", "/login", "/login/staff" in en and hi:
const results = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
expect(results.violations.filter(v => ["serious","critical"].includes(v.impact ?? ""))).toEqual([]);
// perf.spec.ts — on "/menu", sum encoded body sizes of script responses:
expect(totalJsBytes).toBeLessThanOrEqual(150 * 1024);
// visual.spec.ts — 360px, locale hi: await expect(page).toHaveScreenshot("menu-hi-360.png", { fullPage: true });
```

`totalJsBytes` sums `(await response.request().sizes()).responseBodySize` for responses whose `resourceType()` is `"script"`, collected during `page.goto("/menu", { waitUntil: "networkidle" })` against the production build.

- [ ] **Step 2: Run** `npm run test:e2e -- a11y perf visual` (first run with `--update-snapshots` for the baseline). Expected: a11y and perf PASS. If either fails, fix the page (contrast via tokens, labels, lazy-loading, moving code to server components) and do not loosen the gate.
- [ ] **Step 3: Commit**: `git commit -m "test: axe, JS budget and Hindi 360px visual gates"`

**Phase 1 exit check:** full test suite + CI green; owner can change settings and menu from `/admin`; manual pass on a real Android phone at 360 px in both languages.

---

## Execution notes

- Branch per phase: `phase-0-foundation`, `phase-1-menu-site`, …; merge to `main` when the phase exit check passes.
- The detailed plan for Phase 2 is written after Phase 1 is merged, in `docs/superpowers/plans/` with the same structure as Part B.
