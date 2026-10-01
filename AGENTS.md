# RestroSathi: Codex Project Instructions

## Read first, every session

Codex does not open files that this file mentions, so open these yourself at the start of each session:

1. `docs/superpowers/specs/2026-09-29-restrosathi-prototype-design.md` (the spec, v2: what to build)
2. `docs/superpowers/plans/2026-10-01-restrosathi-implementation-plan.md` (the plan: how, task by task)
3. `PRODUCT.md` (product truth). `DESIGN.md` too, once it exists.
4. `docs/PROGRESS.md` (what is done, and why any earlier run stopped). Newest entries last.
5. `docs/superpowers/plans/2026-10-02-conventions.md` and, for the current task, its phase plan file listed in `docs/QUEUE.md`. `docs/QUEUE.md` is the order of work.
6. `docs/HUMAN-TODO.md` (append to it; see "Human steps" below).

The spec and the plan files are authoritative. Do not edit them, except to tick a finished step's checkbox. If something in them is wrong, unclear or contradicts the code: in single-task mode stop and tell me; in continuous and queue mode follow the **No-stop protocol** below (decide, log, carry on).

## Product

RestroSathi is a single-restaurant operating system for the fictional demo restaurant **Saffron Tadka**: public website, QR table ordering, kitchen board, billing, bookings/WhatsApp and growth features. The first users are restaurants that use no software today.

## How to work

There are three modes. I choose the mode in my prompt.

- **Single-task mode** ("Do Task N"): do only that task, commit, then stop and report.
- **Continuous mode** ("Complete Phase N" or a `/goal`): work through every unticked task of the named phase, in plan order, without waiting for me between tasks. Never go past the end of that phase.
- **Queue mode** ("Run the queue"): work through `docs/QUEUE.md` from the first item not yet logged in `docs/PROGRESS.md`, task after task and phase after phase, without waiting for me, until the queue is finished or your usage limit is close (see the No-stop protocol). At the end of a phase do its Gate row, create the next phase's branch from the current commit, and carry on. Do not stop at a phase boundary in this mode.

Rules for both modes:

- Do each task exactly as written, steps in order, failing test first.
- **Every phase now has a step-by-step plan file** (listed in `docs/QUEUE.md`). Do the tasks in those files. Do not invent tasks that are not in them. Where a phase plan and the roadmap in Part A of the main plan differ, the phase plan wins.
- Do not silently expand scope. Features from later phases stay hidden behind `FEATURES` in `src/lib/features.ts`.
- Inspect the existing code and tests before changing anything.
- Run the focused tests first. Before calling a task done, run its verification commands and read the real output.
- **One commit per task**, only after its acceptance criteria pass. One branch per phase (`phase-0-foundation`, `phase-1-menu-site`, …). Never commit a failing test, a skipped test or a weakened gate.
- Never weaken a test, gate or budget to make something pass. Fix the cause (single-task mode: or stop and tell me; continuous and queue mode: or park the task, see the No-stop protocol).

### Continuous mode: the loop

Repeat until the phase is finished or your usage limit is close (No-stop protocol):

1. Read `docs/PROGRESS.md` and `git log` to find the next unticked task. Make sure you are on the phase branch with a clean working tree.
2. Do the task (skills as described below), tick its checkboxes in the plan, commit.
3. Append one entry to `docs/PROGRESS.md` (task, commit hash, tests run and result, anything notable) and commit it with the task commit or as a follow-up `docs:` commit.
4. Go straight to the next task. Do not ask "shall I continue?".

When the last task of a phase is done, do the phase's **Gate** (its gate section in the plan file): the full lint, typecheck, unit, integration and e2e commands, every exit criterion, and a summary headed exactly `## Phase N summary` in `docs/PROGRESS.md`. In continuous mode then write the final request (see No-stop protocol) and **stop**. In queue mode commit, create the next phase branch from this commit, and carry on. In both modes: never merge to `main`, never delete branches, never force-push.

Headings in `docs/PROGRESS.md` must be exactly `## Task N: <title>` and `## Phase N summary` so scripts can find them.

### Human steps (never block on them)

Some steps need a person: a real server or domain, WhatsApp pairing, API keys, a real bucket, real devices, Strix, the pilot. When the plan marks a step **[HUMAN]**, or you hit one, build everything around it with fakes and tests, append an item to `docs/HUMAN-TODO.md` (what, why it needs a person, exact steps), and **continue**. Never put real secrets in the repo; `.env.example` holds fictional placeholders only. Never use a real external service in tests.

### Fix small problems yourself (do not stop for these)

The plan was written by hand and will have small mistakes: steps in a slightly wrong order, a file or script missing from a task's file list, a command that needs a flag, a dependency install not mentioned, a typo in a path. For these, **make the obvious fix and keep going**:

- Reorder steps, create a missing config file earlier, add a missing file to a task, fix a command, install a plan-allowed dependency, adjust an npm script.
- You may start Docker Compose, run migrations, install allowed packages and create any file the task obviously needs.
- Keep the intent: the task's behaviour, tests, acceptance criteria, constraints and the spec stay as written.
- Record every such fix as one line under a **Deviations** heading in that task's `docs/PROGRESS.md` entry, so I can review it later. No question, no pause.

### No-stop protocol (continuous and queue mode)

I start these modes and then leave, often overnight. **Nobody is there to answer.** So in continuous and queue mode:

- **Never ask me a question and never wait for an answer.** Do not use any ask-the-user tool and do not end a turn with a question. Pick the most reasonable option, log it, and keep going. Everything I need to answer goes into the final request (below).
- **Never mark the goal "blocked" or "complete" early.** The goal ends only when the queue (or the phase) is finished, or your usage or time limit is close.
- **Never ask for permission or approval** for ordinary work: running tests, Docker Compose, migrations, npm installs of allowed packages, git commits on the phase branch, creating or editing files.

What to do instead of stopping:

1. **Plan is wrong, unclear, or contradicts the code or the spec.** Spec wins for behaviour (what the product does, prices, tax, auth, data shape). The plan wins for order, names and file lists. If the spec itself is ambiguous, take the simplest safe reading. Write one line under **Decisions for Hariom** in that task's PROGRESS entry and carry on.
2. **A test or command keeps failing.** Make 3 different fix attempts. Still failing: step back, find the root cause (reproduce, read the real error, check the plan's assumption) and make 3 attempts with a different approach. Still failing: **park the task** (below).
3. **A gate or budget fails** (accessibility, 150 KB JS, 360 px, Hindi). Fix the cause. Never weaken it. After the same 6 attempts, record `GATE FAILED: <which, why>` in the phase summary and carry on to the next phase.
4. **A new dependency outside the allowed list.** Prefer a few lines of your own code or something already installed. If it is really needed, add one well-known, actively maintained package at an exact version, put a one-line reason in the commit message, and add a "review this dependency" item to `docs/HUMAN-TODO.md`. Do not install anything on my machine outside the repo.
5. **A paid or real external service, key, SIM, server, bucket, domain.** Use the fake or local stand-in, and append what I must provide, with exact steps, to `docs/HUMAN-TODO.md` and the **Keys and access** list for the final request.
6. **A destructive or irreversible action** (deleting data, branches or files that are not yours, force-push, resetting a database that is not the test database). Never do it. Pick a non-destructive route, or skip that step and log it. Only the test database may be reset.
7. **Usage or time limit close.** Finish or save the current task cleanly (commit, or save as below), append the PROGRESS entry, and end. This is the only normal reason to stop before the queue is finished.

**Parking a task.** A parked task must never block the rest of the queue:
- Save the unfinished work: `git switch -c parked/task-N`, `git add -A`, commit `wip: parked Task N`, `git switch` back to the phase branch (clean tree).
- Append `## Task N: <title> [PARKED]` to `docs/PROGRESS.md` with: what was tried, the exact failing output, your best guess at the cause, and what would unblock it. Add a line to `docs/HUMAN-TODO.md`. Commit.
- Go on to the next task. If a later task truly depends on the parked one and cannot work without it, park that one too with the reason "depends on Task N". Do the parts that do not depend on it.
- A Gate that fails only because of parked tasks is recorded as `GATE NOT PASSED: parked Tasks …` in the phase summary. Do not weaken the gate. Carry on to the next phase.

**End of the queue: the final request.** When the last Gate is done (or your limit is close), write `docs/FINAL-REQUEST.md` and print it as your last message. This is the **only** place you ask me for anything:
1. **Keys and secrets** I must provide: the exact variable name in `.env`, which service it comes from, what it unlocks, and what runs on a fake until then (for example `ANTHROPIC_API_KEY`, the WA-AKG base URL, session id and API key, the Razorpay-style keys if any, the backup bucket keys).
2. **Access and permissions** I must grant: VPS and domain, WhatsApp number pairing, GitHub merge and branch protection, anything that needs my login.
3. **Decisions for Hariom**: every "Decisions for Hariom" line, one per bullet, with your default and how to change it.
4. **Parked tasks and failed gates**: each with the one thing that would unblock it.
5. **First three things to do tomorrow**, in order.
Keep it short and concrete. Never put a real secret in the repo.

### What may be edited outside the task

The spec: never. The plan: tick checkboxes only. `docs/PROGRESS.md`: append only. Task file lists are a guide, not a fence: you may create or change other files when the task needs them (for example `package.json`, `package-lock.json`, config files, generated files such as `prisma/migrations/`). Do not add a dependency outside the plan's allowed list except as rule 4 of the No-stop protocol says.

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
- Each phase's Gate includes a code-level security review you write yourself (`docs/security/phase-N-review.md`) and an authorization-matrix test. Running Strix against a live staging site is a **human** step (`docs/HUMAN-TODO.md`): before the Phase 2 demo URL is shared, after Phase 3, and in full in Phase 6.
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
