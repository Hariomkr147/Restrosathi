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

## Task 3: Internationalisation (English / Hindi) (2026-10-02, branch phase-0-foundation, commit 4c8ea3d)
- Tests: red `npm run test:unit` failed in 2 missing-module/message suites. Final unit run passed 3 files / 8 tests; integration passed 2 files / 4 tests; `npm run test:e2e -- i18n` passed 6 checks across mobile and desktop. Lint, typecheck and diff whitespace checks exited 0.
- Behaviour: the validated public locale action stores NEXT_LOCALE for one year; invalid cookie values use English. The provider and html lang follow the cookie. Missing/blank Hindi DB text falls back to English; Settings.about now validates with l10nSchema, and fresh seeds include English and Hindi demo text.
- Reviews: Ponytail review: Lean already. Ship. Impeccable shape used the settled task brief: a familiar language button for phone users, the existing tokens and Button, with pending/error feedback. Audit and hardening covered keyboard focus, targets at least 44 px, invalid locale, reduced motion, long Hindi at 360 px, network error announcement and retry; the detector found no issues. Desktop/mobile screenshots were inspected. The public menu and home design work, including DESIGN.md, remains in Phase 1.
### Deviations
- Pinned next-intl 4.4.0, which declares Next 16 support, after 4.14.8's plugin failed to load a native SWC module blocked by Windows Application Control; no system policy was changed.
- Scoped the E2E error assertion to the locale alert's text because Next also renders a route-announcer alert; the role and exact error-content assertions remain.
- Used the detailed task/spec as the Impeccable shape brief and continued under the user's continuous-mode/no-per-step-questions instruction instead of adding a confirmation pause.

## Task 4: Owner password and staff PIN authentication (2026-10-02, branch phase-0-foundation, commit 1a13ec5)
- Tests: red unit run failed on the missing password module; red integration run failed on the missing session module after correcting the cookie mock's hoisted export. Final focused checks passed 4 unit files / 12 tests and 3 integration files / 16 tests. Lint and typecheck exited 0; `npm run test:e2e -- auth` passed 8 checks on desktop/mobile against the production build.
- Behaviour: salted scrypt secrets, hash-only DB session tokens with 12-hour secure production cookies, active-user/role guards, owner password and active-staff PIN login, logout, and per-user/IP lockout. The fifth failure within 15 minutes triggers a full 15-minute lockout; tests cover expiry and spread-out failures. Integration fixtures expose the planned owner/staff/anonymous cookie helpers.
- UI checks: labelled forms, 44 px PIN keys, visible keyboard focus, English/Hindi login and admin roles, long Hindi without 360 px horizontal overflow, wrong-PIN feedback, and retained credentials plus retry after a network failure. Hindi desktop/mobile screenshots were inspected. Impeccable was not used on auth, as AGENTS.md requires.
- Reviews: Ponytail review: Lean already. Ship. No new dependency. All Task 4 checkboxes are complete; the full Phase 0 exit check runs after this commit.
### Deviations
- Added the shared LoginForm and auth/login module so both real login paths share UI feedback and persistence stays in src/lib/auth; added login/admin message keys, CI seed env and Vitest alias inheritance needed by those paths.
- E2E now resets and uses only TEST_DATABASE_URL via the existing guarded setup; repeated authentication tests do not alter development data or accumulate lockouts there.
- Replaced localhost in DB URLs with the Compose binding's explicit IPv4 address. A mobile login trace showed a 5.6-second pending action; measured concurrent credential checks were 2.1–4.2 seconds with localhost and 139–203 ms with 127.0.0.1. The original tests and timeouts are unchanged; temporary timing logs were removed.
- Set the spec's 100 KB server-action body limit and corrected the locale error's class to the existing mapped destructive token.
- Seed credentials are clearly fictional, declared in .env.example and read from server env. Proxy IP keys use the validated last forwarded address, with an unknown fallback; account keys always apply independently.

## Phase 0 summary: Foundation complete (2026-10-02, branch phase-0-foundation)
- Task commits: Task 1 e5c7b49, Task 2 162ec24, Task 3 4c8ea3d, Task 4 1a13ec5. All their plan steps are ticked.
- Full local verification after Task 4: `npm run lint` and `npm run typecheck` exited 0; `npm run test:unit` reported `Test Files 4 passed (4), Tests 12 passed (12)`; `npm run test:int` reported `Test Files 3 passed (3), Tests 16 passed (16)`; `npm run test:e2e` reported `18 passed (31.0s)` against the production build, with no retries or skipped tests.
- CI: https://github.com/Hariomkr147/Restrosathi/actions/runs/36923501435 completed successfully on baacacd4eb21ba2166bafedf94fe35abee349004. Node 22 install, database generate/migrate/seed, lint, typecheck, unit, integration and E2E steps all succeeded on Ubuntu/PostgreSQL 17.
- Exit criteria: anonymous /admin redirects to login; owner and staff login/logout work; locale toggle persists and changes html lang; development seed has Settings row 1 for Saffron Tadka, one active owner with password hash and Ravi with PIN hash. Compose PostgreSQL is healthy. Development data was not reset.
- Surface checks: English/Hindi, keyboard focus, contrast, reduced motion, 44 px controls, long Hindi at 360 px without horizontal overflow, and failed-network feedback/retry passed. Menu JS and axe gates are planned in Phase 1.
- Ponytail full phase audit: Lean already. Ship. Required security, validation, business rules and tests were retained; no additional abstraction or dependency was introduced for the audit.
- Notes: this machine uses Node 22 from the task runtime and the existing Docker Desktop installation, with host PostgreSQL port 15432 to avoid the unrelated existing 5432 listener. next-intl remains pinned to 4.4.0 because Windows blocks the newer plugin's native module. Existing npm install advisories were recorded in Task 2; no unsolicited security scan was run.
- Next: the user's continuous Tasks 1-10 goal explicitly authorizes moving to phase-1-menu-site and Task 5. Phase 2 remains out of scope; main was not changed.

## Task 5: Menu model and pricing rules (2026-10-02, branch phase-1-menu-site, commit 0ad4ff2)
- Tests: red unit run failed in two missing pricing/schema suites; red integration run failed in the missing query suite. Final unit result: 6 files / 39 tests passed. Integration: 4 files / 19 tests passed. Lint, typecheck and diff whitespace checks exited 0.
- Behaviour: Phase 1 menu models, validated localized inputs and reads, exclusive base-price/variant rules, integer prices, modifier bounds, server pricing and typed choice errors. Ordered public query includes sold-out items and omits empty categories. Seed adds 20 fictional dishes in six categories with the specified variants/options, no-Hindi fallback fixture and a long Hindi name.
- Reviews: Ponytail full review: Lean already. Ship. No new dependency or UI surface; responsive/accessibility checks belong to Task 6. All Task 5 checkboxes complete.
### Deviations
- Added an additive generated menu migration and explicit sortOrder fields on modifier groups/options/pairings to persist the planned ordering. Deployed and seeded the development database without resetting it; seed upserts preserve later owner edits.
- Added unknown-variant, duplicate-option, untrusted client-price, malformed-input, empty-category and invalid localized-read checks alongside the planned tests. Repeated option IDs are treated as one selection.

## Task 6: Public menu page (2026-10-02, branch phase-1-menu-site, commit 021ee38)
- Tests: red unit run failed on missing filter module. Final unit: 7 files / 44 tests passed. Production E2E across menu/i18n/auth/smoke: 24 passed (48.9s). A new explicit target-size check then found Home at 42.890625 px wide; after adding the existing minimum-width token, final focused menu E2E: 6 passed (16.6s). Full lint, focused changed-file lint, typecheck and whitespace checks exited 0; bilingual key check passed after final Hindi wording clarification.
- Behaviour: dynamic view-only menu with bilingual search, vegetarian filter, sticky category links/scroll spy, dietary shapes and text, spice, tags, optional lazy photos, exact named variant prices and sold-out badges. Empty/loading/error/retry states are localized. Long Hindi and missing-Hindi Kulfi fallback passed at 360 px without page-level horizontal scroll.
- Reviews: Ponytail full review: Lean already. Ship. Impeccable shape used the authoritative task and existing visual world; detector [] (exit 0); audit/hardening recorded in local .impeccable/menu-audit.md. Fresh finish review: ship, followed by a scoped header-fix verdict of resolved/ship. Final English desktop and Hindi mobile captures inspected. Formal axe/150 KB gates remain Task 10.
- Design: first real visual work documented in DESIGN.md and a local schemaVersion2 sidecar with ten component snippets; YAML/JSON and source token references validated. Theme remains the token authority; no raw hex outside theme or new dependency. All Task 6 steps complete. Task 5 CI passed at 86da3a4: https://github.com/Hariomkr147/Restrosathi/actions/runs/36924616333.
### Deviations
- Moved the placeholder home into the public route group so it receives the planned shell; moved the root language toggle into public/login/admin layouts to keep exactly one on every surface. Locale keyboard test now traverses the added header/skip links instead of assuming the toggle is the first Tab stop.
- Added localized loading/error boundaries, a skip link, browser selection/caret styles and a menu anchor-offset token for the required UI states and access. Ignored local .impeccable workflow artifacts while committing durable DESIGN.md.
- Stale generated Next route types referenced the old home path. Direct cache deletion was rejected by automatic policy review; Next's own temporary dev server on port 3001 and next typegen refreshed the files. The dev server was stopped; checks and timeouts stayed unchanged.
- Used fresh generic subagents for finish-review/documenter roles because this harness exposes generic task spawning rather than named agent-type selectors. Kept the plan-pinned brief without repeated confirmation under continuous-mode authorization; documented actual tokens without synthetic palette ramps. Existing missing buildPath config drift was reported and left unchanged.

## Task 7: Home page, SEO and feature flags (2026-10-02, branch phase-1-menu-site, commit 1d5ed35)
- Tests: failing unit suite first (missing SEO module); final unit 8 files / 49 tests passed. Production home E2E 4 passed (30.0s), including keyboard menu navigation, 44px targets, Hindi/reduced motion and long Hindi heading overflow. Lint, typecheck and whitespace checks exited 0. Initial E2E used a mistaken contact label; corrected it to the existing Chat on WhatsApp message without weakening assertions.
- Behaviour: settings-derived hero/story/metadata, max-six CHEFS_SPECIAL signature dishes, hours, conditional map/review links, Call and WhatsApp contacts, safe JSON-LD preserving overnight shifts; booking/event features remain false. Illustrative generated food photo public/brand/hero.webp is 165866 bytes; exact prompt retained in hero.webp.json (Imagegen built-in generation; installed Sharp WebP conversion).
- Reviews: Ponytail full: Lean already. Ship. Impeccable audit/harden/polish observed-scope17/20; independent critique28/32, zero P0/P1, detector[] exit0. Fresh finish review ship/no material fixes; desktop and Hindi mobile captures inspected. Ordinary-extension documenter preserved existing design files and reported placeholder-home wording/menu-focused sidecar/config drift without repairing it. Source token authority unchanged, no new dependency. Temporary port3002 review server stopped. All Task7 steps complete.
- CI: Task6 at e34db716b78120b52feaa629bbd6a7e0c8578f14 succeeded: https://github.com/Hariomkr147/Restrosathi/actions/runs/36927630436.
- Phase1 Android manual check deferred at the user's explicit request, 'skip for now'; automated bilingual360px checks remain required. This is not represented as a real-device pass.
### Deviations
- Added HeroEntrance, message keys, SITE_URL and owned placeholder image/provenance as necessary task support files; used installed Sharp rather than introducing a dependency before Task9.
- Used fresh generic independent critique/finish/documenter agents because named agent profiles are unavailable in this harness; proceeded under authorized continuous mode. Read-only browser API cannot inject an overlay; fresh hidden-tab browser evidence and CLI detector used, with no claimed overlay.

## Task 8: Settings editor (owner)
- Commit d3570f4 on phase-1-menu-site. Red integration run: 6 failed (missing updateSettings), 19 existing passed. Final integration: 5 files / 25 tests passed; unit: 8 files / 49 passed. Final production settings E2E: 2 passed (34.0s). Lint, typecheck and whitespace checks exited 0.
- Owner-only validated settings editor, bilingual grouped native form, optional HTTPS links, +91 contacts, closed/two-shift controls and overnight hours. Settings write and before/after audit commit atomically. Inline errors, busy controls, Saved feedback and network retry preserve drafts. Closed/reopen restores edited shifts; editing any field or hours clears old Saved feedback.
- Impeccable shape used the authoritative Task8/Operate brief; audit/harden18/20 observed scope, detector[] exit0, desktop/Hindi360 captures inspected. Fresh finish reviewer found stale Saved status; fixed and E2E asserts status disappears after editing. Verdict pass scored that fix resolved/ship. Ordinary-extension documenter preserved existing design files; existing documentation drift left unchanged. Ponytail full: Lean already. Ship. No dependency added.
- Task7 CI f8496f36a9c28a820ad2cae65a3c23454f2d5a8e succeeded: https://github.com/Hariomkr147/Restrosathi/actions/runs/36930246651.
### Deviations
- Added SettingsForm, localized validation keys, reachable owner navigation, settings E2E and an optional transaction-client parameter to audit for atomic persistence.
- Set Playwright workers=1 because public/admin checks mutate the same seeded restaurant settings/menu; assertions, timeouts, retries and gates remain unchanged. Keyboard focus check switches to keyboard modality before testing focus-visible.
- Queue startup stashed the verified Task8 work while new planning commits were added. Inspected and reapplied that exact Task8 stash non-destructively before committing; recovery stash retained. This explains the documenter's temporary inability to find the E2E assertion; restored source contains it at line52.
### Decisions for Hariom
- Under the updated queue instructions, continue beyond Phase1 through the detailed phase plans. Human-only steps go to HUMAN-TODO; no further questions during the run.

## Task 9: Menu editor, sold-out switch, photo upload
- Commit e01c4c2 on phase-1-menu-site. Failing integration suites first (missing image/mutation modules); final integration: 8 files / 44 tests passed. Unit: 9 files / 53 passed. Final production menu-admin E2E: 4 passed (48.8s). Lint, typecheck and whitespace checks exited 0.
- Owner category/item editing, up/down ordering, base-price or named portions, bilingual fields, modifier choices, dietary/spice/tags and safe photo preview/upload. Staff availability switches immediately update the public menu. Exact decimal draft prices become integer paise. Price and availability audits are atomic; concurrent replacements lock the parent item so only one complete variant set remains.
- Uploads validate content and size, strip metadata, resize to 1200px and store UUID WebP files locally. Public serving checks resolved paths, rejects traversal and supplies immutable caching. Negative tests cover anonymous/staff access, cross-origin upload, bounded chunked bodies and invalid structures.
- Impeccable audit/harden18/20 observed scope; detector[] exit0; four English/Hindi360 captures inspected. Fresh finish reviewer: ship/no material fixes; documenter preserved the incumbent design files and reported existing documentation drift. Ponytail full review: Lean already. Ship. Formal axe/performance gates follow in Task10. All Task9 steps complete.
### Deviations
- Added a bounded authenticated same-origin multipart POST route for the 5MB photo flow, keeping the spec's global server-action limit at 100KB. Added supporting form components, exact decimal parser, localized messages, route tests and range/choice validation tests.
- Docker Desktop was stopped; started the existing installation hidden and brought the existing Compose database up without resetting development data. Replaced a corrupt synthetic PNG fixture with a valid generated test PNG; read Sharp test metadata from a buffer to avoid Windows file-cache cleanup locks.
- Anchored /uploads/ in gitignore so runtime photos are ignored while src/app/uploads remains tracked. Marked runtime filesystem paths with Turbopack's tracing annotation; final build has no whole-project upload tracing warnings.
- New concurrency test first reproduced duplicate variant sets; added a parent-row lock shared by item editing and availability writes. Network-retry assertion initially matched Next's route announcer too; scoped it to the actual localized save error.
- Used fresh generic finish/documenter agents because this harness has no named-profile selector. No new storage abstraction or AWS dependency was introduced.
### Decisions for Hariom
- Photos use a 40-million-pixel decode ceiling and reject multi-page/animated inputs to bound image-processing memory. Safe still JPEG/PNG/WebP images up to 5MB retain the planned conversion behaviour.
