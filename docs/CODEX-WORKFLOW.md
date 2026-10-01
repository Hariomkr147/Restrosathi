# RestroSathi: Codex Workflow

For you, not for Codex. Codex reads `AGENTS.md`; this file says how *you* drive it.
Last checked: 2026-10-01.

## 1. One-time setup

1. Open this folder in Codex (`C:\Users\Hario\Documents\Restrosathi`). On Windows, WSL2 avoids most path and line-ending problems. Docker Desktop (or Docker in WSL2) is needed from Task 2.
2. Install the skills from the project root:

```bash
# Impeccable (UI/UX): verified against its README
npx impeccable install --providers=codex --scope=project

# Ponytail (complexity control): Codex plugin install from its README
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

3. Restart Codex. For Impeccable, open `/hooks` and approve the project hook.
4. Type `$` (or run `/skills`) and write down the exact names you see for the Impeccable and Ponytail skills (`$ponytail`, `$ponytail-review`, `$ponytail-audit`). Ponytail's README says `@` in Codex, but Codex's own docs say `$`, so use whichever the list shows. If a name differs from the ones in `AGENTS.md`, tell Codex.
5. Optional, for copy only: **No AI Slop** (`npx skills add https://github.com/petergyang/no-ai-slop --skill no-ai-slop`). I have not verified this command; check its README first. Without it, the work still goes fine.
6. Make sure the repo is committed (`git status` is clean) before Task 1.

## 2. What each file does

| File | Job |
|---|---|
| `AGENTS.md` | Rules Codex follows every session |
| `PRODUCT.md` | What RestroSathi is, who uses it, what must never be invented |
| `DESIGN.md` | Visual rules; created later by `$impeccable document` |
| `src/brand/theme.css` | The real colour/spacing/motion values (created in Task 1) |
| `docs/superpowers/specs/…` | What to build (v2 spec) |
| `docs/superpowers/plans/…` | How to build it, task by task, with tests |
| `docs/CODEX-WORKFLOW.md` | This file |

## 3. What to type: copy-paste prompts

**Start a session (any day):**
```text
Read AGENTS.md, PRODUCT.md, the v2 spec and the implementation plan.
Then tell me, in 5 lines or fewer, which phase and task we are on, based on the ticked checkboxes and git log.
Do not change any files yet.
```

**Do one task:**
```text
Execute Task N of the implementation plan, and only Task N.
Follow its steps in order, starting with the failing test.
Tick each step's checkbox in the plan as you finish it.
Make the single commit the task asks for, then stop and show me the test output.
```

**Task fails or is unclear:**
```text
Stop. Show me the failing output and what you think the cause is.
Do not change the tests or the plan to make it pass.
```

**Review before moving on:**
```text
Run $ponytail-review on the last commit. Do not remove validation, auth, audit logging, tests or transactions.
List what you would change, but do not change anything yet.
```

**End of a phase:**
```text
Run the full lint, typecheck, unit, integration and e2e commands. Show the output.
Then run $ponytail-audit and list the findings. Do not apply fixes yet.
Check each exit criterion for this phase in the plan and tell me which pass.
```

**Next phase planning:** bring the roadmap section for that phase back to Claude (or any planner) and write its detailed task list *before* telling Codex to start it.

## 4. The loop for each task

Most tasks (data, logic, auth, billing):
1. `$ponytail` while implementing
2. Focused tests
3. `$ponytail-review`
4. Commit

UI tasks, add around it:
1. `$impeccable shape <surface>` before building
2. Build
3. `$impeccable audit <surface>` and `$impeccable harden <surface>`
4. Home page and `/t/[code]` only: also `critique` and `polish`

Phase 0 has no real UI: use only Ponytail. Run `$impeccable init` after Task 1, and `$impeccable document` once the `/menu` page exists.

Never run a design skill on billing logic, order states or auth. Check those yourself.

## 5. Phase checklist

| Phase | Start | Finish |
|---|---|---|
| 0 Foundation | Tasks 1–4 | Full tests green; CI green; `$ponytail-audit` |
| 1 Menu + website | Tasks 5–10 | Axe, 150 KB and Hindi 360 px gates pass; try it on a real phone |
| 2 QR ordering + kitchen | Write detailed plan first | **Code security review before sharing the demo URL** |
| 3 Billing | Write detailed plan first | Security review again; concurrency and day-end tests |
| 4–5 | Write detailed plan first | `$ponytail-audit`; phase exit criteria |
| 6 Go-live | Write detailed plan first | Full Strix pass on staging, restore drill, pilot checklist |

## 6. Things you can skip

- **Taste-Skill, Hallmark, Stop Slop:** these overlap with Impeccable and No AI Slop. Don't install them.
- **Anti-Slop:** there are two unrelated projects with this name.
  - `miqdadbadjuber/anti-slop` is a rulebook for frontend, prose and code comments, with 38 rules and a PASS/FAIL report on every delivery. It overlaps with Impeccable and No AI Slop, and it adds work to every task. Optional: try it *instead of* No AI Slop when you write copy, not on top of Impeccable. Codex install per its README: `codex plugin marketplace add miqdadbadjuber/anti-slop` then `codex plugin add antislop@anti-slop`.
  - `dmmulroy/anti-slop` is a set of TypeScript lint rules (Oxlint). Its `no-module-mocking` rule conflicts with the plan, which mocks cookies in tests and uses fakes for WhatsApp and AI. It would also be a second linter next to ESLint. Skip for now; revisit after Phase 1 as a trial on its own branch.

## 6b. Floci (local AWS emulator): Phase 6

Not used in Phases 0–5. In Phase 6 (Task 44, off-site backups) it acts as a local S3 for testing the backup upload and restore scripts:

```yaml
services:
  floci:
    image: floci/floci:latest
    ports:
      - "127.0.0.1:4566:4566"
    # no Docker socket mount: S3 does not need it
```

The app or scripts then use `AWS_ENDPOINT_URL=http://floci:4566` with dummy credentials. Floci is an emulator, so the real backup bucket must also be tested once for real before go-live.

## 7. Security tools (Strix), when the time comes

- Skills: `application-security-testing` (picks the right test), `find-security-vulnerabilities-in-code`, `web-app-penetration-testing`, `fix-security-vulnerabilities-with-strix`, `ci-security-scanning-with-strix`. I haven't verified how they install; check Strix's README then.
- Order: code review → staging test → fix and re-test → CI checks.
- Only test your own staging site with test accounts and test data. Never test a restaurant's live system or anyone else's.

## 8. Gotchas

- Task 1 runs `create-next-app` in this folder. It could overwrite `AGENTS.md` or files in `docs/`. Commit first, then check `git status` afterwards and restore anything it changed.
- Codex doesn't read files that `AGENTS.md` mentions, which is why the prompts above ask it to open them.
- If Codex starts doing several tasks at once, stop it and re-send the "Do one task" prompt.
- If it asks to change the plan or a test, say no unless you've agreed the change.
