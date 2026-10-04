# RestroSathi model handoff

Updated 2026-10-04 (Asia/Kolkata). This is a continuation snapshot, not a replacement for the spec, task plans or AGENTS.md. Recheck Git and the files before acting; this document will become stale as work continues.

## Start here

We were running the queue. Phase 1 and Phase 2 Tasks 11–14 are finished. **Resume at Phase 2, Task 15: customer table page `/t/[code]`. Its implementation is in the working tree, but the task is not finished or committed.** Finish it before starting Task 16.

The user requested this handoff instead of continuing implementation in this turn. The app goal currently reports `paused`; do not infer a fresh authorization to resume from that status. When the user tells the next model to resume, the intended scope is the remaining queue, subject to their new instructions.

Copy and paste this prompt into the next LLM:

```text
You are continuing work on RestroSathi in the shared repository. Read docs/HANDOFF.md first, then read AGENTS.md and every startup/authoritative file it names. The spec, queue and task plans are authoritative; follow AGENTS.md's queue-mode workflow. Treat my request as authorization to continue independently through the entire remaining queue, from the existing Task 15 working tree through the last phase Gate. Do not stop after Task 15 or a phase boundary. Do not ask me between tasks. Continue until all queue tasks and Gates are finished, or the documented usage/time limit is close. Send a short progress update while sustained work is underway.

Start on phase-2-qr-ordering. There is substantial uncommitted Task 15 work. Inspect git status and the actual files before changing anything; preserve and finish this work. Do not reset, clean, overwrite, recreate or switch away from it. Task 15 has Steps 1–3 done; complete its outstanding tests, review and documentation before Task 16. Use the test output and pending investigations in docs/HANDOFF.md as leads, then verify them against the current code.

Follow each phase plan exactly: failing tests first, steps in order, focused checks first, no weakened tests/gates/budgets, one commit per task after acceptance passes, then append a PROGRESS entry and tick only completed task-plan/QUEUE checkboxes. At each phase Gate, do every listed check, write the required code-level security review and auth-matrix coverage, append the exact Phase summary, then create the next phase branch from the current completed commit and continue. Never merge to main, delete branches or force-push. Normal pushes to the configured origin were already authorized; push completed phase/task commits as the repository workflow requires. Do not deploy or publish anything.

Use the project-required skills/plugins where applicable, especially Impeccable for UI tasks and Ponytail review/audit. First check which are already installed or callable. If a required plugin/skill is missing, find and install the relevant one using the environment's supported plugin/skill installer; the user authorizes installing the project-required skills/plugins for this work. Install only what the current task needs. If installation is unavailable or requires a user-only action, continue with the documented references and best available workflow, record the limitation, and do not abandon the task. Never install dependencies outside the plan's allowance without following AGENTS.md's explicit dependency rule. Do not use Impeccable to alter product facts, planned behavior, DESIGN.md or its sidecar as an incidental extension.

Human-only actions never block the queue: build local fakes, append exact steps to docs/HUMAN-TODO.md and continue. The user explicitly deferred the physical Android 360px check (“skip for now”); keep it logged as pending and do not claim it passed. Do not put secrets in the repo. Continue to respect all product, security, money, time-zone, Hindi, accessibility, responsive, bundle-size, migration and database-safety constraints in AGENTS.md and the plans.

At the actual end of the queue (or when the usage/time limit is close), prepare docs/FINAL-REQUEST.md as AGENTS.md specifies and report it. Do not mark the queue complete until every required task and Gate really is complete. Do not stop just because this handoff was created; I am asking you to resume and continue the work.
```

## Authoritative files to read

1. `AGENTS.md`.
2. `docs/superpowers/specs/2026-09-29-restrosathi-prototype-design.md` — v2 product specification.
3. `docs/superpowers/plans/2026-10-01-restrosathi-implementation-plan.md` — main plan and earlier phases.
4. `PRODUCT.md`, `DESIGN.md`.
5. `docs/PROGRESS.md` — append-only; latest completed entry is Task 14.
6. `docs/QUEUE.md`, `docs/superpowers/plans/2026-10-02-conventions.md`.
7. `docs/superpowers/plans/2026-10-02-phase-2-qr-ordering-plan.md` — Task 15 starts around line 120.
8. `docs/HUMAN-TODO.md`.

The spec decides behavior; phase plans decide task order and steps. Edit spec/plan files only to tick finished checkboxes. PROGRESS headings must be `## Task N: <title>` or `## Phase N summary`. Do not treat this handoff's suggestions as extra planned tasks.

## Git and transfer safety

- Workspace: `C:\Users\Hario\Documents\Restrosathi`.
- Branch: `phase-2-qr-ordering`.
- HEAD: `5f7a0f7` (`docs: record Task 14 verification`).
- Origin: `https://github.com/Hariomkr147/Restrosathi.git`. Normal pushes to phase branches were authorized earlier.
- Task 15 consists of tracked modifications **and untracked source/test/migration files**. `git diff` alone omits the untracked work: inspect `git status --short` too. Do not clean, reset, overwrite, regenerate the whole app or switch away with this work unresolved.
- This handoff is also uncommitted. No commit or push was made for the handoff request. Include it deliberately in later documentation work if appropriate.
- A model using this same workspace can continue directly. A fresh GitHub clone will **not** contain Task 15 or this handoff until they are committed/transferred. Local ignored review artifacts and skills also require separate transfer if moving computers; never transfer actual secrets into Git.

Recent completed task commits (followed by documentation commits):

| Task | Implementation | Documentation |
|---|---|---|
| 11 — tables/QR sheet | `afe919e` | `c3fbaec` |
| 12 — dining sessions | `686b3d9` | `237edef` |
| 13 — order placement | `35d691e` | `24d09fe` |
| 14 — transitions/voids | `f7f17ba` | `5f7a0f7` |

These are pushed. Main has not been merged into or force-pushed. Task 15 must retain the requested single implementation commit after acceptance passes; its exact message is `feat: customer table page with ordering, tracker, call waiter and bill view`. PROGRESS may be included with it or in the permitted docs follow-up.

## Current Task 15 implementation

Plan Steps 1–3 are checked: tests written, red run observed, implementation built. Steps 4–6 and its QUEUE row remain unchecked. No Task 15 PROGRESS completion entry exists.

Implemented in the uncommitted work:

- `prisma/schema.prisma` and additive migration `20261002023000_service_requests`: `ServiceKind` and session-linked `ServiceRequest`, resolution fields and lookup index. Applied to development without resetting it.
- `src/lib/orders/cart.ts` plus unit tests: reducer, line identity from dish/variant/sorted options/trimmed note, quantity bounds, remove/clear/count.
- `session-view.ts` plus integration tests: active table code scopes reads to its current non-closed session; bilingual order snapshots, UTC timestamps; rejected/voided lines excluded from amount. Unknown/inactive codes return null.
- `service-requests.ts` plus integration tests: public waiter/bill requests; shared table/session lock; one open request per kind/session; duplicate returns success without another rate hit; device limit 10/hour **per kind**; bill request changes session status atomically.
- Extended public actions at `src/app/t/[code]/actions.ts`; status GET at `src/app/api/t/[code]/status/route.ts`, no-store and unknown-code 404. Auth matrix documents the new public exceptions.
- `/t/[code]` page/layout/loading/error/friendly not-found routes. Layout validates code before its loading boundary, ensuring an actual HTTP 404 rather than a streamed 200. Parent `/t/not-found.tsx` provides the friendly layout-level boundary.
- `src/components/table/`: `OrderScreen`, lazy native-dialog `ItemSheet` and `Cart`, shared `Sheet`/`Quantity`/resolved `TableText`, `StatusTracker`, `BillView`.
- Existing menu rows/search/category/veg components reused with optional Add actions. Public `/menu` stays view-only. Available pairings appear in the item sheet.
- Client display prices use the server-rendered menu and existing pricing helper; order placement always reprices on the server. A UUID is created for the first nonempty cart and retained across failed placement until success.
- Polls status every 3 seconds, pauses/aborts hidden tabs, refreshes on visibility return and backs off failed polls up to 30 seconds. Preserves cart after placement failure. Services show Requested after refreshed status confirms them. Amount is labeled “Amount so far”; no payment control.
- English/Hindi message keys, theme-owned sheet size, bottom-sheet CSS/reduced-motion handling, `FEATURES.qrOrdering = true`. Other future flags remain false.
- `tests/helpers/db.ts`: guarded test-only client, fixed `TABLE_CODES`, operational-data cleanup, sold-out/long-Hindi/orderable-dish fixtures. Extend this helper in later tasks.
- `tests/e2e/table-order.spec.ts` includes planned cases plus network retry, bilingual keyboard/sheet/quantity/empty-cart focus, and polling/backoff/hidden-tab recovery checks.

The latest fix adds `id="table-heading"`, `tabIndex={-1}` and focus fallback when an emptied cart closes. The new test first reproduced lost focus on mobile and desktop, then passed after the fix.

## Verification evidence and its limits

Historical runs observed before the last interruption:

- Task 15 focused cart: 4 unit tests passed; session-view/service requests: 8 integration tests passed.
- Full unit: **90 passed**. Full integration: **17 files / 190 passed**. Lint/typecheck exited 0; existing native-menu-image lint advisory remains. These were before the latest focus-only UI change; rerun relevant checks after final changes.
- First production focused suite: **22 passed / 2 failed**; both failures were unknown links returning 200. Fixed layout-level validation, then focused invalid-link/performance checks passed on both projects.
- Bilingual sheet test initially failed only at empty-cart focus return on both projects. Focus fix is now in the code.

Latest terminal run was recovered after the user requested the handoff:

```text
> restrosathi@0.1.0 test:e2e
> playwright test table-order menu smoke

Table JavaScript: 141403 / 153600 bytes
... [mobile] Fast4G ... passed (2.4s test duration)
... [mobile] bilingual sheets ... passed
... [mobile] polling ... passed
Table JavaScript: 141403 / 153600 bytes
... [desktop] Fast4G ... passed (2.2s test duration)
... [desktop] bilingual sheets ... passed
... [desktop] polling ... passed

28 passed (3.6m)
```

`test-results/.last-run.json` also says `passed` with no failed tests. The suite includes `menu-admin` because the `menu` selector matches it. Its assertions retain Fast 4G menu visibility within 3 seconds and the 150 KB budget; test durations above are not substituted navigation measurements. English/Hindi axe, 360px overflow, 44px page controls, choices, double-click one-order, server price, no-payment, network retry and friendly HTTP 404 cases passed. One nonfatal Next web-server log said “The destination stream closed early” during the desktop admin flow; all tests passed. Do not conceal it if it recurs as a reproducible fault.

This is **not** a completed visual review, physical Android pass, full Phase 2 gate, or Task 15 CI pass.

Previous CI evidence:

- [Phase 1 Gate, exact `89e5cc3`](https://github.com/Hariomkr147/Restrosathi/actions/runs/36995762249) — green.
- [Task 13 docs HEAD `24d09fe`](https://github.com/Hariomkr147/Restrosathi/actions/runs/36999188384) — green.
- [Task 14 docs HEAD `5f7a0f7`](https://github.com/Hariomkr147/Restrosathi/actions/runs/36999525340) — green.

Task 13/14 CI links should be included in the next appropriate PROGRESS entry; they have not yet been logged there.

## Exact next work for Task 15

1. Read the current code/tests and inspect the dirty tree. Preserve existing red-test history; do not restart scaffolding or create Task 16 first.
2. Investigate two **code-review observations, not yet browser-reproduced**:
   - ItemSheet stores `valueAsNumber` for quantity. Clearing the field produces NaN, while its price display calls `formatINR(price * qty)`; `formatINR` throws for noninteger money. Add a focused failing browser case for clearing/fractional quantities, then fix the invalid-input rendering without weakening bounds or money validation.
   - Poll refresh aborts at 10 seconds, but catch suppresses every aborted request, including timeouts. Distinguish timeout from cancellation so a hung request displays the existing retry/status message; preserve hidden-tab/unmount cancellation behavior. Reproduce with a focused test before fixing.
3. Finish the required Impeccable audit/harden/critique/polish and independent finish/documentation handoffs described below. No completed Task 15 critique/detector verdict is available from the interrupted agents.
4. Run Task 15's full required unit/integration/focused production E2E (`table-order menu smoke`), lint and typecheck after final edits. Inspect real output. Run Ponytail full complexity review before committing.
5. Tick Step 4 only when verification is complete, Step 5 only when UI workflow is complete. Tick Step 6/QUEUE when actually finished, make the requested commit, and append the Task 15 PROGRESS entry with its hash, output, deviations/decisions. Push normally if continuing the authorized queue. Then proceed to Task 16.

Pending lines to record in Task 15 PROGRESS:

- **Deviations:** added supporting native sheet/quantity/text components, layout-level code validation and parent not-found boundary, public-action auth matrix coverage, helpers and hardening tests. No new dependency.
- **Deviations:** database tests initially could not connect because Docker Desktop was stopped; restarted the existing installation hidden, started Compose Postgres, verified readiness, preserved development data.
- **Deviations:** Prisma migration generated from saved pre-task schema so it does not remove earlier raw session constraints; SQL reviewed before additive apply.
- **Deviations:** Next loading boundaries stream 200 if not-found is raised after streaming; invalid-code validation moved into the layout to meet the explicit HTTP 404 contract. Primary reference: [Next not-found documentation](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).
- **Deviations:** an npm-script grep containing `|` was misparsed by Windows cmd. Used a simple selector/full focused files instead; no assertion or gate changed.
- **Decisions for Hariom:** waiter/bill requests can open an empty table session before the first order, allowing staff help before ordering; the next order joins that session. Verify against the spec's session rules and retain the simplest safe reading under queue mode.

## UI workflow / local evidence

- Current extension preserves established warm theme/menu identity. Operate mode, code-led, no generated imagery or concept roll; Task 15 is the concrete brief.
- Existing brief: `.impeccable/surfaces/src-app-t-code-page-tsx.md` (ignored local file). It records table identity/language, existing menu, native sheets, reachable cart, tracking/amount/service requests, bilingual/focus/performance limits and the direction contract.
- Skill: `.agents/skills/impeccable/SKILL.md`. Read applicable references; context was already run in the preceding session. A genuinely new model session can run its own required context once. Do not rewrite DESIGN.md/sidecar/config as an incidental extension or repair pre-existing drift unasked.
- Task 15 screenshots currently exist under `.impeccable/review/`: `table-order-{mobile|desktop}-{en|hi}.png`, `table-item-{mobile|desktop}-{en|hi}.png`, `table-cart-{mobile|desktop}-{en|hi}.png`. Latest complete set is from the successful 28-test run. **Parent has not visually inspected this Task 15 set yet.** Validate each capture before sending onward. PNGs are review evidence, not shipping assets.
- Parent visual checks are bounded to one batched mobile/desktop/EN/HI round, material fixes, then one confirmation round. Use fresh captures after final fixes.
- The skill calls for isolated critique A (design) and B (detector/browser). Both spawned agents (`table_critique_a`, `table_critique_b`) are interrupted; no completed reports were received. Start fresh assessments if their results cannot be recovered. A must finish before B's detector findings enter parent synthesis; B can work in parallel but hold its findings until released.
- Use fresh browser tabs per assessment if browser tools are available. CUA evaluate is read-only: do not inject scripts through it or claim an overlay exists. Disclose fallback evidence and cleanup.
- Present/persist the complete critique via the skill's storage helper; in queue mode, skip questions explicitly because user instructions prohibit them. Reuse B's complete detector output; do not run redundant parent scans.
- Finish reviewer must be fresh/isolated, receive all validated capture paths, request/brief/craft-floor/detector evidence, and return its actual disposition. Generic agent fallback was used earlier because no named-profile selector is available. Documenter for an ordinary extension is read-only and preserves DESIGN.md, `.impeccable/design.json` and config; reports existing drift. Do not claim either handoff completed.
- Ponytail current local review skill: `C:/Users/Hario/.codex/plugins/cache/ponytail/ponytail/1.0.0/skills/ponytail-review/SKILL.md`; use normal/full, never ultra. It cannot remove planned validation, auth, audit, transactions, accessibility or tests.
- Image viewer has previously cached an overwritten PNG path. If it shows stale content, make a byte-identical copy at a fresh path and compare SHA-256; never change pixels to hide a defect.

## Windows runtime and verification commands

Architecture is Next App Router + strict TypeScript + Prisma/PostgreSQL 17, npm, **Node 22**. Host default Node is newer; use the existing local runtime:

```powershell
Set-Location C:/Users/Hario/Documents/Restrosathi
$env:PATH="$env:TEMP/restrosathi-task1-runtime/node_modules/node/bin;$env:TEMP/restrosathi-task1-runtime/node_modules/.bin;$env:PATH"
node --version
npm.cmd run test:unit
npm.cmd run test:int
npm.cmd run test:e2e -- table-order menu smoke
npm.cmd run lint
npm.cmd run typecheck
git diff --check
```

Run dependent/database suites sequentially; they share seeded test data. Focused tests first when fixing a defect. Playwright builds and starts production on port 3000 itself; no dedicated app server was listening at the handoff check. The completed exec session is closed; no test command needs resuming.

Docker CLI is `C:/Users/Hario/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe`. At handoff, `restrosathi-postgres-1` is healthy and Compose Postgres is bound only to `127.0.0.1:15432`. Use local `.env` settings; `.env.example` defaults to 5432, so do not copy it blindly over working configuration. An unrelated native database uses 5432; leave it alone. Docker Desktop executable is `C:/Users/Hario/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe`; if needed start it hidden, then `docker compose up -d postgres` and verify readiness.

Tests require **separate** `restrosathi_test` and migrate-reset only that database. `tests/setup/db.ts` validates test URL differs from development and path is `/restrosathi_test`; applies real migrations with `migrate reset --force --skip-generate --skip-seed`, then seeds. Keep `connection_limit=20&pool_timeout=30` for concurrency tests. Never reset development or replace migration setup with `db push`.

CI/Linux Hindi goldens depend on the pinned official browser image in `.github/workflows/ci.yml`:

```text
mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
```

It is already downloaded locally. Earlier full Linux gates used verified Node 22.23.3; an ignored `.impeccable/node-linux.tar.gz` and local harness may remain. Do not change visual baselines/tolerances to fit platform font differences. Existing npm advisories: 1 moderate/3 high; no force upgrade was made.

## Important established patterns

- All money integer paise, `formatINR`; UTC storage and Asia/Kolkata display. Localized DB text `{ en, hi? }`, fallback to English, real Hindi UI keys.
- Theme values only `src/brand/theme.css`; 44px targets, WCAG AA, active HTML lang, reduced motion, 360px no horizontal overflow, menu/table initial JS ≤150 KB gzip.
- Protected mutations use `requireUser()` and derive actor from session. Public exceptions are explicit in plan/authz matrix. Every future protected action/route must extend the matrix.
- Changed AI provider from Anthropic to OpenRouter to support custom OpenAI-compatible endpoints ('OPENROUTER_API_KEY').
- Server pricing/choice validation remains authoritative; no client amount is trusted. Same-key concurrent orders produce one order/rate hit.
- Shared table/session transaction locks; one nonclosed session/table is protected by raw CHECK + partial unique index in migration `20261002021000_dining_sessions`. **Do not let Prisma-generated migrations DROP those raw constraints.** Review SQL.
- Task 13 deliberately takes the idempotency advisory lock and device/IP rate checks inside the same atomic transaction, before table/session creation, to avoid charging concurrent retries or failed placement. This documented decision is already in PROGRESS; do not regress it to unconditional pretransaction hits.
- Order transitions are exactly NEW→PREPARING, NEW→REJECTED, PREPARING→READY, READY→SERVED; conditional updates and audits are atomic. Void requires a preparing/ready/served parent and reason. Future bill rules belong to their planned tasks.
- Public JSON route bodies cap at100KB; current `next.config.ts` also keeps server actions at100KB. Photos use a separate authenticated, same-origin, bounded multipart route. The Phase 2 gate's wording about a raised global action limit does not describe current code; inspect/document actual behavior rather than raising it needlessly.
- Local uploads only through Phases0–5, no AWS abstraction; Floci/S3 backup only Phase6 Task44.
- `tests/helpers/auth.ts` supplies mocked cookies and owner/staff/anonymous helpers. New operational E2E specs use/reset `tests/helpers/db.ts`; extend its cleanup as new operational tables arrive.

## Remaining queue and human work

| Phase | Remaining work | Plan |
|---|---|---|
| 2 | Finish15;16 staff board;17 KOT;18 AI menu;19 packaging;Gate2 | `2026-10-02-phase-2-qr-ordering-plan.md` |
| 3 | Tasks20–27 billing/staff orders/reports/customer bill;Gate3 | `2026-10-02-phase-3-billing-plan.md` |
| 4 | Tasks28–36 WhatsApp/OTP/bookings/events/privacy;Gate4 | `2026-10-02-phase-4-whatsapp-bookings-plan.md` |
| 5 | Tasks37–43 customers/loyalty/feedback/dashboard/growth;Gate5 | `2026-10-02-phase-5-growth-plan.md` |
| 6 | Tasks44–47 backups/monitoring/load/preflight/pilot docs;Gate6 | `2026-10-02-phase-6-golive-plan.md` |

All plans are under `docs/superpowers/plans/`; QUEUE controls exact order. At every Gate: full verification, authorization matrix, own code-level security review, phase exit checks and exact PROGRESS summary. Create the next phase branch from current finished commit and continue only within the user's resumed scope. Do not invent missing tasks.

The user explicitly said **“skip for now”** for a real Android 360px EN/HI check; already recorded in HUMAN-TODO. Browser emulation is not physical-device evidence. Other standing human items: real Anthropic key/eval, VPS/domain/deploy, staging Strix before URL sharing, accountant tax decisions, WhatsApp spare-SIM pairing/key, real backup bucket/encryption/restore drill, devices/pilot. Build fakes/local support, append exact human steps and continue in queue mode; never put real secrets in the repository.

No `docs/FINAL-REQUEST.md` exists yet. Write it at the actual queue endpoint or usage/time stop, collecting keys/access, logged decisions, parked tasks/failed gates and the first three next actions. This handoff does not mark Task15, Phase2 or the queue complete.
