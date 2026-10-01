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
| `docs/PROGRESS.md` | Log Codex appends to: tasks done, and why it stopped |
| `scripts/run-phase.sh` | Optional runner: one `codex exec` per task, with checks |
| `docs/CODEX-WORKFLOW.md` | This file |

## 2b. Continuous mode: make Codex work without you

You want Codex to keep going task after task. There are two ways. Both rely on the stop conditions in `AGENTS.md`, so it halts and tells you instead of guessing.

### Option A: `/goal` (simplest, one prompt per phase)

Codex CLI 0.128.0 and later has a `/goal` command that keeps Codex working across many turns until a stop condition is met. Commands: `/goal <objective>`, `/goal` (status), `/goal pause`, `/goal resume`, `/goal clear`.

1. Update Codex: `npm install -g @openai/codex@latest`.
2. Turn it on: `codex features enable goals` (or put `[features]` / `goals = true` in `~/.codex/config.toml`), then restart Codex.
3. Start a fresh session in the repo, on branch `phase-0-foundation`, and send:

```text
/goal Complete Phase 0 (Tasks 1-4) of the implementation plan in continuous mode, as defined in AGENTS.md.
Read AGENTS.md, PRODUCT.md, the v2 spec, the plan and docs/PROGRESS.md first.
Stopping condition: Tasks 1-4 are committed, the full lint, typecheck, unit and integration commands pass, the Phase 0 exit criteria are checked, and the Phase summary is written in docs/PROGRESS.md.
Stop earlier on any AGENTS.md stop condition and write a STOPPED entry. Do not start Phase 1.
```

Check progress with `/goal`, or read `docs/PROGRESS.md` and `git log`. Pause with `/goal pause`.

Caveats, from other people's tests and the docs: a long goal uses a lot of your plan's quota, it works best when "done" can be checked by commands (our tasks can), and it is not a safety feature: the sandbox and `AGENTS.md` are. One long session also piles up context, so for a whole phase Option B is more reliable.

### Option B: runner script (fresh context per task, checks each task itself)

`scripts/run-phase.sh` runs `codex exec` once per task. Each task starts with a clean context, and after each one the script checks that Codex made a commit, logged progress, left a clean tree and that lint, typecheck and tests really pass. It halts on the first problem.

```bash
# from the repo root, on branch phase-0-foundation
scripts/run-phase.sh 1 4        # Phase 0
scripts/run-phase.sh 5 10       # Phase 1, after Phase 0 is merged
touch .stop                     # ask it to halt before the next task
```

Run it in WSL2 or a terminal where `codex`, `node`, `npm` and `docker` all work. Logs go to `.codex-logs/`.

Two things the script cannot fix for you:

- **Sandbox.** `codex exec` runs in the `workspace-write` sandbox by default, with network off. Task 1 (`npm install`) and the Postgres container from Task 2 need network and Docker. If they fail with permission or network errors, either allow network for the sandbox in `~/.codex/config.toml` (`[sandbox_workspace_write]` / `network_access = true`), or run with `SANDBOX=danger-full-access scripts/run-phase.sh 1 4`. The second removes the sandbox, so use it only inside WSL2 or a VM, on a branch, with nothing secret on that machine. I could not test this on your machine, so try Task 1 alone first.
- **It only checks what the plan has.** Passing tests mean the task matches the plan, not that the screen looks good or that billing is right.

### Option C: run the whole queue overnight (queue mode)

Every phase has a detailed plan, and `docs/QUEUE.md` lists all 47 items in order (Phase 1's remaining tasks, then Phases 2–6, with a "Gate" row at the end of each phase). Queue mode **never stops to ask you anything**. A problem it cannot solve is *parked* (work saved on a `parked/` branch, logged, and the queue moves on). Human-only things (API keys, server, WhatsApp pairing, bucket, devices) go to `docs/HUMAN-TODO.md`, and everything it needs from you is collected into one `docs/FINAL-REQUEST.md` at the very end. The rules are the "No-stop protocol" in `AGENTS.md`.

**Before you leave (once):**
1. In the Codex app set permissions to **Full access** (or approvals to *never*). Otherwise Codex pauses on every Docker, npm or git command and waits for a click, which is exactly the stop you do not want. Full access means Codex can run any command on your PC; `AGENTS.md` forbids destructive actions, but the setting is your call. If you prefer less trust, use `workspace-write`; Docker and installs may then fail and get parked.
2. Plug in the laptop and turn off sleep (Settings, System, Power: Screen and sleep: Never while plugged in). A sleeping laptop is the most common reason an overnight run is "stuck".
3. Commit or stash anything of your own. Codex needs a clean tree apart from its own work.

**With `/goal` (the Codex app):** replace the current goal by sending this once. It also continues any half-finished task already in the working tree.

```text
/goal Run the queue in docs/QUEUE.md (queue mode in AGENTS.md) from the first item not yet logged in docs/PROGRESS.md, all the way to Gate 6.
Read AGENTS.md, PRODUCT.md, the v2 spec, docs/superpowers/plans/2026-10-02-conventions.md, docs/QUEUE.md, docs/PROGRESS.md and docs/HUMAN-TODO.md first. If the working tree holds uncommitted work for the current task, continue that task instead of restarting it.
For each item follow its plan file: test first, tick checkboxes, one commit per task, then a PROGRESS entry. Do each Gate row at the end of its phase, then create the next phase's branch from that commit and carry on. Never merge to main.
Follow the No-stop protocol in AGENTS.md exactly: never ask me a question, never wait for approval, never mark this goal blocked. Fix small plan problems yourself. If a task cannot be finished after the attempts the protocol lists, park it and move to the next. Put everything you need from me (API keys, access, decisions) into docs/FINAL-REQUEST.md.
Ending condition: Gate 6 is done (or your usage limit is close) and docs/FINAL-REQUEST.md is written and printed as your last message. That is the only time you ask me for anything.
```

If the session keeps dropping ("Context compaction" failures), pause with `/goal pause`, start a **new** session and send the same goal again. Nothing is lost: progress lives in git and `docs/PROGRESS.md`, and Codex resumes at the first item not logged.

**With the script (WSL or any bash with `codex` installed), the most robust way to run it unattended:** `scripts/run-queue.sh` does one `codex exec` per item with a fresh context. It waits and retries when Codex reports a usage limit (every 30 minutes, up to 12 hours), retries other Codex errors, gives an unfinished item a second pass, then parks it, and runs lint, typecheck, unit and integration tests after every item (and e2e after every Gate) with one automatic repair pass. It never halts on a problem; it records it and moves on. `scripts/run-queue.sh 6 15` runs only rows 6–15. `touch .stop` halts it before the next item. Set `SANDBOX=danger-full-access` if Docker commands fail in the default sandbox.

**What to expect:** 42 more items. Each takes 20–40 minutes at the pace of Phase 1, so a full run is **days of Codex time, not one night**. With the `/goal`, it ends when your Codex usage limit is reached (send the goal again later). With the script, it sleeps through the limit and continues by itself. In the morning read `docs/PROGRESS.md` (newest last) and `git log`; at the end read `docs/FINAL-REQUEST.md`.

**What you still do yourself:** answer `docs/FINAL-REQUEST.md`; read `docs/HUMAN-TODO.md`; look at each phase's result on a phone before trusting it (especially the customer pages and the staff board); read `docs/PROGRESS.md` Deviations and Decisions for Hariom; merge phase branches to `main` only after you have looked. Anything involving money (Phase 3) deserves your own check of invoice numbers, GST and round-off.

### Which to use

Option C (the queue) is the one for leaving it running. Use Option B (`run-phase.sh`) for one phase at a time, or Option A if you would rather watch one session. After each phase, read `docs/PROGRESS.md` and look at the app.

### Where you should still look yourself

- After Phase 1: open the site on a real phone.
- Before sharing the Phase 2 demo URL and after Phase 3 (billing): the security reviews in section 7, plus your own check of invoice numbers, GST and round-off.
- Any `[PARKED]` entry or `GATE NOT PASSED` line in `docs/PROGRESS.md`: read it, fix the cause or change the plan on purpose, then re-run that item. Don't just rerun.
- Cost: each run uses model quota. Check usage after the first task before leaving a phase running overnight.

## 3. What to type: copy-paste prompts

**Start a session (any day):**
```text
Read AGENTS.md, PRODUCT.md, the v2 spec and the implementation plan.
Then tell me, in 5 lines or fewer, which phase and task we are on, based on docs/PROGRESS.md, the ticked checkboxes and git log.
Do not change any files yet.
```

**Do one task (single-task mode, when you want to watch each step):**
```text
Execute Task N of the implementation plan, and only Task N.
Follow its steps in order, starting with the failing test.
Tick each step's checkbox in the plan as you finish it.
Make the single commit the task asks for and log it in docs/PROGRESS.md, then stop and show me the test output.
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
- In single-task mode, if Codex starts doing several tasks at once, stop it and re-send the "Do one task" prompt. In continuous mode that is expected, but it must still stop at the end of the phase.
- If it asks to change the plan or a test, say no unless you've agreed the change.
