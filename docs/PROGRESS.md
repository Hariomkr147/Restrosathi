# Progress log

Append-only. Codex adds one entry per finished task, and a STOPPED entry whenever it halts. Read the newest entries first when resuming.

Entry format:

```text
## Task N: <title>  (<date>, branch <branch>, commit <hash>)
- Tests: <commands run> → <pass/fail counts>
- Notes: <anything unexpected, or "none">
```

```text
## STOPPED at Task N: <reason number from AGENTS.md>
- What failed (exact command and output, trimmed):
- What I tried:
- What I need from you:
```

---

(No tasks done yet.)

## Task 1: App skeleton, brand tokens, money formatting, CI (2026-10-02, branch phase-0-foundation, commit e5c7b49)
- Tests: initial `npm run test:unit` failed because `./format` was missing; after implementation, 1 unit file / 3 tests passed. `npm run lint` and `npm run typecheck` exited 0. Final `npm run test:e2e` passed 4 checks across desktop and mobile against the production build. `npm ci` completed successfully (476 packages installed).
- Checks: English html language, brand tokens, text and focus contrast, reduced motion, and injected long Hindi heading without horizontal overflow at 360 px. The actual locale toggle belongs to Task 3.
- Notes: Node 22.23.3 was used. The locked uppercase workspace could not be renamed, so a lowercase `restrosathi` project was scaffolded in a temporary directory and copied here, preserving project docs. Local skill files remain ignored as requested. Node types were matched to Node 22; shadcn was initialized with Radix and unused starter packages/artwork were removed. Next's automatic AGENTS.md generation was disabled. Git's local author was set from the existing repository history. CI is configured; no remote CI run was triggered.
- Reviews: Ponytail review completed. Impeccable init/context reviewed the existing product record after Task 1; no product facts or visual rules were changed. Its legacy PRODUCT.md schema finding was left for a separate requested migration.

## STOPPED at Task 2: reason 4 from AGENTS.md (2026-10-02)
- What failed: `docker version` exited 1: `The term 'docker' is not recognized as a name of a cmdlet, function, script file, or executable program.` Task 2 requires Docker Compose and PostgreSQL before its integration tests can run.
- What I tried: checked PATH and the machine-wide and per-user standard Docker Desktop executable locations; the command and both executables were absent. The working tree was clean at the Task 2 prerequisite check.
- What I need from you: make Docker Desktop available and running for this workspace, with working `docker version` and `docker compose version` commands, then resume the run.
- State: Task 1 is complete (e5c7b49; verification recorded in e2ebfcb). Tasks 2-10 remain pending. No Task 2 code, tests, or checkbox changes were made. Phase 0 has not reached its exit check; Phase 1 has not started. The original Tasks 1-10 objective remains incomplete.

## STOPPED at Task 2: reason 2 from AGENTS.md (2026-10-02)
- Resolved prerequisite: Windows installed-app records identified Docker Desktop at `C:/Users/Hario/AppData/Local/Programs/DockerDesktop`. Its CLI reports a running Linux engine (29.8.1) and Docker Compose v5.5.1. The earlier PATH/standard-location checks missed this installation; Docker is now usable through its actual path.
- What blocked: Task 2 requires `prisma` and `@prisma/client`, both explicitly allowed by the plan, but neither is declared in package.json. Task 2's file list omits package.json and package-lock.json; AGENTS.md says "Nothing else outside the task's own file list." Installing the required dependencies changes those files.
- What I tried: inspected the Task 2 contract, package.json, Vitest configuration and AGENTS.md; `npm ls prisma @prisma/client --depth=0` reports an empty dependency tree. No Task 2 code, tests or checkbox changes were made.
- What I need from you: allow package.json and package-lock.json updates when needed for dependencies already explicitly allowed by the plan, or amend the task file lists yourself. The spec and plan were left unchanged.

## STOPPED at Task 2: reason 2 from AGENTS.md (2026-10-02)
- Resolved scope: commit fb4bf22 permits plan-approved package and lockfile changes and lists the Task 2 dependency installs.
- What failed: Task 2 Step 2 runs `docker compose up -d && npm run test:int`, but Step 3 creates `docker-compose.yml`. The exact Step 2 command exited 1 with `no configuration file provided: not found`; its `&&` prevented the integration tests from running.
- Additional evidence: ran `npm run test:int` separately under Node 22.23.3. Vitest reported `Test Files 2 failed (2)`: audit could not import `../db`, and settings could not import `./index`. These are the planned missing-module failures; no implementation was written.
- State: Task 2 Step 1 tests and the integration test project configuration, together with its checkbox, were stashed as `Task 2 red tests: stopped on Compose step ordering`. No failing work was committed. Task 1 remains complete; Tasks 2-10 and both phase exit checks remain incomplete.
- What I need from you: correct the Task 2 step order so the Compose configuration exists before its Step 2 command, or explicitly authorize running the red integration tests separately and starting Compose after Step 3. I have not changed the plan's text or weakened its checks.

## Task 2: Database, Settings, audit log (2026-10-02, branch phase-0-foundation, commit 162ec24)
- Tests: red integration run failed with two missing-module suites; final `npm run test:int` passed 2 files / 4 tests. `npm run lint` and `npm run typecheck` exited 0; `npm run test:unit` passed 1 file / 3 tests. `git diff --check` passed.
- Runtime: Compose PostgreSQL 17.11 is healthy; the generated foundation migration applied to the development database and the seed created Settings row 1 for Saffron Tadka. Integration setup resets only the separate restrosathi_test database, verifies its name and separation before resetting, then seeds it; files run serially.
- Reviews: Ponytail review: Lean already. Ship. No UI surface was added in this task.
- Notes: Prisma's package.json seed deprecation notice is expected on 6.19.3. npm's install summary reported 3 high severity findings; no separate security scan or automatic breaking upgrade was run. The earlier scope and ordering stops are resolved by the updated AGENTS.md in 13ada84. All Task 2 checkboxes are complete.
### Deviations
- Ran the red integration command separately because the planned Compose configuration is created in Step 3; started Compose after writing that configuration, preserving the failing-test-first requirement.
- Added a configurable host port (default 5432); this machine's existing listener owns 5432, so its ignored .env uses localhost:15432 while the container stays on 5432. Existing processes and databases were not changed.
- Selected Prisma/client 6.19.3 to retain the plan's db push --skip-generate and package.json prisma.seed interfaces; added db:generate, db:migrate and db:seed scripts, a generated initial migration and CI database initialization.
