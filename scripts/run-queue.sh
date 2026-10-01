#!/usr/bin/env bash
# Works through docs/QUEUE.md with a fresh Codex context per item, and halts on the first problem.
# Usage: scripts/run-queue.sh            (whole queue)      scripts/run-queue.sh 6 15   (queue rows 6 to 15)
# Env:   SANDBOX=workspace-write (default) | danger-full-access   (see docs/CODEX-WORKFLOW.md)
# Stop it: create a file named .stop in the repo root, or press Ctrl+C. Safe to re-run: finished items are skipped.
set -uo pipefail
cd "$(dirname "$0")/.."

from=${1:-1}; to=${2:-9999}
sandbox=${SANDBOX:-workspace-write}
mkdir -p .codex-logs

[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean. Commit or stash first."; exit 1; }

stopped() { grep -c '^## STOPPED' docs/PROGRESS.md || true; }
fail() { echo "HALT: $1"; exit 1; }

# rows: "<n>|<item>|<branch>"
mapfile -t rows < <(awk -F'|' '/^\| [0-9]+ \|/ { n=$2; i=$3; b=$6; gsub(/^ +| +$/,"",n); gsub(/^ +| +$/,"",i); gsub(/[ `]/,"",b); print n "|" i "|" b }' docs/QUEUE.md)
[ "${#rows[@]}" -gt 0 ] || fail "no rows found in docs/QUEUE.md"

for row in "${rows[@]}"; do
  IFS='|' read -r n item branch <<<"$row"
  [ "$n" -ge "$from" ] && [ "$n" -le "$to" ] || continue
  [ ! -e .stop ] || { echo "Found .stop, halting before $item."; exit 0; }

  if [[ "$item" == Task\ * ]]; then
    num=${item#Task }; kind=task
    grep -q "^## Task $num:" docs/PROGRESS.md && { echo "$item already logged, skipping."; continue; }
  else
    num=${item#Gate }; kind=gate
    grep -q "^## Phase $num summary" docs/PROGRESS.md && { echo "$item already logged, skipping."; continue; }
  fi

  current=$(git branch --show-current)
  if [ "$current" != "$branch" ]; then
    if git show-ref --verify --quiet "refs/heads/$branch"; then git switch "$branch" || fail "cannot switch to $branch"
    else git switch -c "$branch" || fail "cannot create $branch"; fi
  fi

  echo "=== $item ($branch): $(date '+%H:%M:%S') ==="
  before=$(git rev-parse HEAD); stops_before=$(stopped)

  if [ "$kind" = task ]; then
    prompt="Read AGENTS.md, PRODUCT.md, the v2 spec, docs/superpowers/plans/2026-10-02-conventions.md, docs/QUEUE.md, docs/PROGRESS.md and the plan file for this task.
Single-task mode: execute $item only, test first, tick its checkboxes, make its commit, and append its entry (heading exactly '## Task $num: <title>') to docs/PROGRESS.md.
Fix small plan problems yourself and log them under Deviations. Human-only steps go to docs/HUMAN-TODO.md and never block you. If an AGENTS.md stop condition applies, write a STOPPED entry and stop."
  else
    prompt="Read AGENTS.md, PRODUCT.md, the v2 spec, docs/superpowers/plans/2026-10-02-conventions.md, docs/QUEUE.md, docs/PROGRESS.md and the plan file for this phase.
Do the Gate for Phase $num exactly as its gate section and the 'Gate procedure' in docs/QUEUE.md say. Write '## Phase $num summary' in docs/PROGRESS.md and commit. Do not merge to main.
If an AGENTS.md stop condition applies, write a STOPPED entry and stop."
  fi

  codex exec --sandbox "$sandbox" "$prompt" 2>&1 | tee ".codex-logs/queue-$n.log"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "codex exited with an error on $item"

  [ "$(stopped)" = "$stops_before" ] || fail "Codex wrote a STOPPED entry. Read docs/PROGRESS.md."
  [ "$(git rev-parse HEAD)" != "$before" ] || fail "no new commit for $item"
  if [ "$kind" = task ]; then grep -q "^## Task $num:" docs/PROGRESS.md || fail "no PROGRESS entry for $item"
  else grep -q "^## Phase $num summary" docs/PROGRESS.md || fail "no phase summary for $item"; fi
  [ -z "$(git status --porcelain)" ] || fail "uncommitted changes left after $item"

  # Independent check: do not trust Codex's own report.
  npm run lint && npm run typecheck && npm run test:unit && npm run test:int || fail "independent checks failed after $item"
  if [ "$kind" = gate ]; then npm run test:e2e || fail "e2e failed at $item"; fi
done

echo "Queue finished (rows $from-$to). Read docs/PROGRESS.md and docs/HUMAN-TODO.md."
