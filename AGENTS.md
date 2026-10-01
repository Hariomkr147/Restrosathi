# RestroSathi: Codex Project Instructions

## Read first, every session

Codex does not open files that this file mentions, so open these yourself at the start of each session:

1. `docs/superpowers/specs/2026-09-29-restrosathi-prototype-design.md` (the spec, v2: what to build)
2. `docs/superpowers/plans/2026-10-01-restrosathi-implementation-plan.md` (the plan: how, task by task)
3. `PRODUCT.md` (product truth). `DESIGN.md` too, once it exists.

The spec and plan are authoritative. Do not edit them, except to tick a finished step's checkbox in the plan. If something in them is wrong, unclear or contradicts the code, **stop and tell me**; do not work around it.

## Product

RestroSathi is a single-restaurant operating system for the fictional demo restaurant **Saffron Tadka**: public website, QR table ordering, kitchen board, billing, bookings/WhatsApp and growth features. The first users are restaurants that use no software today.

## How to work

- **One task at a time.** Do exactly the task I name (for example "Task 3"), following its steps in order, including the failing test first.
- **Only Phases 0 and 1 have step-by-step tasks.** Phases 2–6 are a roadmap. Do not start a phase, or invent its tasks, until its detailed plan exists in `docs/superpowers/plans/`. Ask me instead.
- Do not silently expand scope. Features from later phases stay hidden behind `FEATURES` in `src/lib/features.ts`.
- Inspect the existing code and tests before changing anything.
- Run the focused tests first. Before saying a task is done, run its verification commands and show me the real output.
- **One commit per task**, after its acceptance criteria pass. One branch per phase (`phase-0-foundation`, `phase-1-menu-site`, …).
- After the commit, **stop** and report: what changed, test output, anything unexpected.
- Never weaken a test, gate or budget to make something pass. If a gate fails, fix the cause or tell me.

## Architecture

- One Next.js App Router app, TypeScript `strict`, Node.js 22 LTS, npm.
- Server actions and route handlers over PostgreSQL via Prisma.
- `src/lib/<area>/` owns the rules and persistence for its area.
- Docker Compose is the runtime boundary.
- Use only the dependencies the plan allows. A new dependency needs a one-line reason in its commit message.

## Non-negotiable constraints

- Money is integer paise. Display only through `formatINR(paise)`.
- Store times in UTC; display in `Asia/Kolkata`.
- Localized DB text is `{ en: string; hi?: string }`.
- UI strings live in `messages/en.json` and `messages/hi.json`; every English key exists in Hindi. Hindi is real Hindi, not transliteration.
- Missing Hindi text falls back to English, never blank or `undefined`.
- Colours, spacing, radius and motion come only from `src/brand/theme.css`. No raw hex anywhere else.
- WCAG 2.2 AA. Touch targets ≥ 44 px. `<html lang>` matches the active locale. Respect `prefers-reduced-motion`.
- `/menu` (and later `/t/[code]`): within the JS budget (≤ 150 KB gzipped) and no horizontal scroll at 360 px.
- Every mutation calls `requireUser()` unless the plan marks it public.
- Never trust client prices. Recompute on the server.
- Overnight opening hours are valid. Invalid menu structures and unsafe uploads are rejected with a clear message.
- WhatsApp or AI failures never block an order, bill or booking.

## Skills

Use the smallest set that covers the task. Skills are invoked with `$name`. If a name below doesn't match, type `$` or `/skills` to see the installed names.

### `$ponytail`: complexity control
- Use it while implementing. Run `$ponytail-review` before committing a non-trivial task, and `$ponytail-audit` at the end of a phase.
- Normal ("full") level only. Never `ultra`.
- **Ponytail never removes or skips a planned task, a planned test, or any of:** validation, authentication or authorization, security controls, error handling, audit logging, accessibility, transactions, concurrency protection, or business rules. If it suggests cutting one of these, ignore it and tell me.

### `$impeccable`: UI/UX
- Surfaces: public website, menu, admin and settings, kitchen board, billing, forms.
- For a new surface: `$impeccable shape <surface>` → build → `$impeccable audit <surface>` and `$impeccable harden <surface>`.
- Add `critique` and `polish` only for the home page and `/t/[code]`, the screens customers see.
- Run `$impeccable init` once after Task 1. Run `$impeccable document` after the first real visual work to write `DESIGN.md`.
- It must work with `src/brand/theme.css`, never replace it. It must not invent restaurant facts, change currency or bilingual rules, remove required states or tests, or redesign a business workflow.
- Do not use it on billing logic, order states or auth. Operational screens (staff, kitchen, billing) get clear, familiar, conservative design; expressive design belongs on public pages.

### `$no-ai-slop`: prose only (if installed)
- Homepage copy, menu descriptions, CTAs, WhatsApp and customer messages, docs.
- Never use it on code. Keep the real facts and uncertainty. Never invent testimonials, statistics, claims or credentials. Keep privacy and legal text's meaning exactly.

## Design authority

- `PRODUCT.md`: product truth. `DESIGN.md`: visual rules. `src/brand/theme.css`: actual token values. `AGENTS.md`: your behaviour. Spec and plan: scope and acceptance criteria.
- Task 1 runs `create-next-app` in this folder. Before it, make sure everything is committed. Afterwards run `git status`. If `AGENTS.md`, `PRODUCT.md` or anything under `docs/` was changed or overwritten, restore it with `git checkout -- <file>` and keep the generated project files.

## Floci (local AWS emulator): Phase 6 only

- **Phases 0–5:** do not add Floci, AWS SDKs or a storage abstraction. Uploads go to a local folder (`UPLOAD_DIR`) as the plan says.
- **Phase 6 (Task 44, off-site backups):** use Floci as the local S3 to test the backup upload and restore scripts. Image `floci/floci:latest`, endpoint `http://floci:4566` inside Compose, port bound to `127.0.0.1` only, dummy credentials. For tests, `@floci/testcontainers` may be used.
- Do not mount the Docker socket into Floci unless a service truly needs it (S3 does not).
- Floci is an emulator, not AWS. The real backup target (an S3-compatible bucket) must be tested once for real before go-live.
- Add `src/lib/storage/` only if uploads themselves move to object storage, and only then.

## Security

- Security scanning is a deliberate step, never automatic. Scan only systems I own, preferably local or staging, using test accounts and test data.
- Run a code-level security review (`$find-security-vulnerabilities-in-code`, if installed) **before the Phase 2 demo URL is shared**, and again when Phase 3 billing is complete. Full testing happens in Phase 6.
- Read scan output before applying fixes. A truncated scan is not a clean result.

## Environment

The plan's shell commands are bash-style and assume Docker. On Windows, prefer WSL2. Do not change a gate or command just to fit the shell; tell me.

## Definition of done

A task is done only when:
- its behaviour matches the task contract,
- its focused tests pass and its verification output has been shown to me,
- accessibility, performance and responsive checks for the surface pass,
- Hindi and long-text overflow cases are checked,
- no unnecessary dependency or abstraction was added,
- the phase exit criteria remain achievable.
