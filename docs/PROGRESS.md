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
