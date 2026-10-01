#!/usr/bin/env bash
# Runs Codex task by task with a fresh context each time, and stops on the first problem.
# Usage: scripts/run-phase.sh <first-task> <last-task>     e.g. scripts/run-phase.sh 1 4
# Env:   SANDBOX=workspace-write (default) | danger-full-access   (see docs/CODEX-WORKFLOW.md)
# Stop it any time: create a file named .stop in the repo root, or press Ctrl+C.
set -euo pipefail
cd "$(dirname "$0")/.."

first=${1:?first task number}; last=${2:?last task number}
sandbox=${SANDBOX:-workspace-write}
mkdir -p .codex-logs

[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean. Commit or stash first."; exit 1; }

for n in $(seq "$first" "$last"); do
  [ ! -e .stop ] || { echo "Found .stop, halting before Task $n."; exit 0; }
  if grep -q "^## Task $n:" docs/PROGRESS.md; then echo "Task $n already logged, skipping."; continue; fi

  echo "=== Task $n: $(date '+%H:%M:%S') ==="
  before=$(git rev-parse HEAD); stops_before=$(grep -c "^## STOPPED" docs/PROGRESS.md || true)

  codex exec --sandbox "$sandbox" "Read AGENTS.md, PRODUCT.md, the v2 spec, the implementation plan and docs/PROGRESS.md.
Single-task mode: execute Task $n only, following its steps in order, failing test first. Tick its checkboxes, make its commit, and append its entry to docs/PROGRESS.md.
If any AGENTS.md stop condition applies, write a STOPPED entry in docs/PROGRESS.md and stop." \
    2>&1 | tee ".codex-logs/task-$n.log" || { echo "codex exited with an error on Task $n."; exit 1; }

  [ "$(grep -c "^## STOPPED" docs/PROGRESS.md || true)" = "$stops_before" ] || { echo "Codex wrote a STOPPED entry. Read docs/PROGRESS.md."; exit 1; }
  [ "$(git rev-parse HEAD)" != "$before" ] || { echo "No new commit for Task $n."; exit 1; }
  grep -q "^## Task $n:" docs/PROGRESS.md || { echo "No PROGRESS entry for Task $n."; exit 1; }
  [ -z "$(git status --porcelain)" ] || { echo "Uncommitted changes left after Task $n."; exit 1; }

  # Independent check: do not trust Codex's own report. Task 1 creates these scripts.
  npm run lint && npm run typecheck && npm run test:unit && npm run test:int || { echo "Independent checks failed after Task $n."; exit 1; }
done

echo "Tasks $first-$last done. Next: run the end-of-phase checks (docs/CODEX-WORKFLOW.md)."
