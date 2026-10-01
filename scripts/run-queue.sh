#!/usr/bin/env bash
# Works through docs/QUEUE.md with a fresh Codex context per item. It does NOT halt on a problem:
# it retries, repairs once, parks the item (work saved on a parked/ branch) and carries on.
# Usage: scripts/run-queue.sh            (whole queue)      scripts/run-queue.sh 6 15   (queue rows 6 to 15)
# Env:   SANDBOX=workspace-write (default) | danger-full-access   (see docs/CODEX-WORKFLOW.md)
#        LIMIT_WAIT=1800 (seconds to sleep when Codex reports a usage limit)   LIMIT_TRIES=24 (so up to 12 h)
# Stop it: create a file named .stop in the repo root, or press Ctrl+C. Safe to re-run: logged items are skipped.
set -uo pipefail
cd "$(dirname "$0")/.."

from=${1:-1}; to=${2:-9999}
sandbox=${SANDBOX:-workspace-write}
limit_wait=${LIMIT_WAIT:-1800}; limit_tries=${LIMIT_TRIES:-24}
mkdir -p .codex-logs

[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean. Commit or stash first."; exit 1; }

GIT=(git -c user.name="${GIT_AUTHOR_NAME:-$(git config user.name || echo Codex)}" -c user.email="${GIT_AUTHOR_EMAIL:-$(git config user.email || echo codex@localhost)}")
logged() { # $1=kind $2=num
  if [ "$1" = task ]; then grep -q "^## Task $2:" docs/PROGRESS.md; else grep -q "^## Phase $2 summary" docs/PROGRESS.md; fi
}

# Run codex; wait and retry on usage limits; retry twice on other errors. Returns 0 if codex exited cleanly.
run_codex() { # $1=log $2=prompt
  local tries=0 errs=0
  while :; do
    codex exec --sandbox "$sandbox" "$2" 2>&1 | tee -a "$1"
    [ "${PIPESTATUS[0]}" -eq 0 ] && return 0
    if tail -n 40 "$1" | grep -qiE 'usage limit|rate limit|quota|try again (at|in|later)'; then
      tries=$((tries+1)); [ "$tries" -le "$limit_tries" ] || return 1
      echo "Usage limit. Sleeping ${limit_wait}s ($tries/$limit_tries)."; sleep "$limit_wait"
      [ ! -e .stop ] || return 1
    else
      errs=$((errs+1)); [ "$errs" -le 2 ] || return 1
      echo "Codex error. Retrying in 60s ($errs/2)."; sleep 60
    fi
  done
}

# Save any unfinished work on a parked branch, log the item as PARKED, carry on.
park() { # $1=kind $2=num $3=item $4=branch $5=reason
  local cur; cur=$(git branch --show-current)
  if [ -n "$(git status --porcelain)" ]; then
    git switch -c "parked/$2-$(date +%s)" >/dev/null 2>&1 && git add -A && "${GIT[@]}" commit -qm "wip: parked $3 ($5)" && git switch "$cur" >/dev/null 2>&1
  fi
  if ! logged "$1" "$2"; then
    if [ "$1" = task ]; then printf '\n## Task %s: %s [PARKED by run-queue.sh]\nReason: %s. Unfinished work (if any) is on a parked/ branch; log: .codex-logs/queue-*.log.\n' "$2" "$3" "$5" >> docs/PROGRESS.md
    else printf '\n## Phase %s summary\nGATE NOT COMPLETED by run-queue.sh: %s. See .codex-logs and the parked/ branches.\n' "$2" "$5" >> docs/PROGRESS.md; fi
    printf -- '- [ ] PARKED %s: %s. Read the log and the parked/ branch, then fix or re-run that item.\n' "$3" "$5" >> docs/HUMAN-TODO.md
    git add docs/PROGRESS.md docs/HUMAN-TODO.md && "${GIT[@]}" commit -qm "docs: park $3 ($5)"
  fi
  echo "PARKED $3: $5"
}

# rows: "<n>|<item>|<branch>"
mapfile -t rows < <(awk -F'|' '/^\| [0-9]+ \|/ { n=$2; i=$3; b=$6; gsub(/^ +| +$/,"",n); gsub(/^ +| +$/,"",i); gsub(/[ `]/,"",b); print n "|" i "|" b }' docs/QUEUE.md)
[ "${#rows[@]}" -gt 0 ] || { echo "no rows found in docs/QUEUE.md"; exit 1; }

NOSTOP="No-stop rules (AGENTS.md 'No-stop protocol'): never ask me a question, never wait, never mark the goal blocked. Fix small plan problems yourself and log them under Deviations. Human-only steps and decisions go to docs/HUMAN-TODO.md. If you cannot finish after several different attempts, park the item as AGENTS.md says and stop this item only."

for row in "${rows[@]}"; do
  IFS='|' read -r n item branch <<<"$row"
  [ "$n" -ge "$from" ] && [ "$n" -le "$to" ] || continue
  [ ! -e .stop ] || { echo "Found .stop, halting before $item."; exit 0; }

  if [[ "$item" == Task\ * ]]; then num=${item#Task }; kind=task; else num=${item#Gate }; kind=gate; fi
  logged "$kind" "$num" && { echo "$item already logged, skipping."; continue; }

  current=$(git branch --show-current)
  if [ "$current" != "$branch" ]; then
    if git show-ref --verify --quiet "refs/heads/$branch"; then git switch "$branch" || { park "$kind" "$num" "$item" "$branch" "cannot switch to branch"; continue; }
    else git switch -c "$branch" || { park "$kind" "$num" "$item" "$branch" "cannot create branch"; continue; }; fi
  fi

  echo "=== $item ($branch): $(date '+%H:%M:%S') ==="
  log=".codex-logs/queue-$n.log"; : > "$log"

  if [ "$kind" = task ]; then
    prompt="Read AGENTS.md, PRODUCT.md, the v2 spec, docs/superpowers/plans/2026-10-02-conventions.md, docs/QUEUE.md, docs/PROGRESS.md, docs/HUMAN-TODO.md and the plan file for this task.
Execute $item only: test first, tick its checkboxes, make its commit, and append its entry (heading exactly '## Task $num: <title>') to docs/PROGRESS.md. $NOSTOP"
  else
    prompt="Read AGENTS.md, PRODUCT.md, the v2 spec, docs/superpowers/plans/2026-10-02-conventions.md, docs/QUEUE.md, docs/PROGRESS.md, docs/HUMAN-TODO.md and the plan file for this phase.
Do the Gate for Phase $num exactly as its gate section and the 'Gate procedure' in docs/QUEUE.md say. Write '## Phase $num summary' in docs/PROGRESS.md and commit. Do not merge to main. $NOSTOP"
  fi

  run_codex "$log" "$prompt" || { park "$kind" "$num" "$item" "$branch" "codex kept failing or the usage limit did not clear"; continue; }

  # Entry missing or tree dirty: give Codex one more pass to finish the item cleanly.
  if ! logged "$kind" "$num" || [ -n "$(git status --porcelain)" ]; then
    run_codex "$log" "Continue $item. Finish it, commit, and make sure docs/PROGRESS.md has its entry (exact heading format). If it cannot be finished, park it as AGENTS.md says. $NOSTOP" || true
  fi
  if ! logged "$kind" "$num" || [ -n "$(git status --porcelain)" ]; then park "$kind" "$num" "$item" "$branch" "not finished after a second pass"; continue; fi

  # Independent check: do not trust Codex's own report. One repair pass, then record and carry on.
  checks() { npm run lint && npm run typecheck && npm run test:unit && npm run test:int && { [ "$kind" != gate ] || npm run test:e2e; }; }
  if ! checks > ".codex-logs/checks-$n.log" 2>&1; then
    run_codex "$log" "After $item the independent checks fail (tail of the output: $(tail -n 40 ".codex-logs/checks-$n.log" | tr '\n' ' ')). Fix the cause, test first, never weaken a test or gate, commit. If you cannot, park the cause as AGENTS.md says. $NOSTOP" || true
    if ! checks > ".codex-logs/checks-$n.log" 2>&1; then
      printf '\n## CHECKS FAILED after %s\nlint/typecheck/tests still fail after one repair pass (see .codex-logs/checks-%s.log). Later items continue.\n' "$item" "$n" >> docs/PROGRESS.md
      printf -- '- [ ] CHECKS FAIL after %s: run the checks, fix, commit.\n' "$item" >> docs/HUMAN-TODO.md
      git add docs/PROGRESS.md docs/HUMAN-TODO.md && "${GIT[@]}" commit -qm "docs: record failing checks after $item"
    fi
  fi
done

echo "Queue finished (rows $from-$to). Read docs/FINAL-REQUEST.md, docs/PROGRESS.md and docs/HUMAN-TODO.md."
