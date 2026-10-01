# Human to-do (things Codex cannot do)

Codex appends here as it builds. Each item: what, why it needs a person, and the exact command or click path. Tick the box when done. Newest phase last. At the end of Phase 6 Codex groups these and puts the top five at the top.

Format:

```text
- [ ] (Phase N, Task M) What to do. Why a person is needed. Exact steps.
```

## Standing items (already known)

- [ ] (Phase 2, Task 18) Anthropic API key: create one, set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` on the server, then run `npm run ai:eval` once and read the 30 results. Needs your account and billing.
- [ ] (Phase 2, Task 19) First deploy: provision a VPS, point a domain, follow `docs/DEPLOY.md`. Needs your server and domain.
- [ ] (Phase 2 gate) Before sharing the demo URL: run Strix against staging (Docker + an LLM key, your own staging site, test data only) and read every finding.
- [ ] (Phase 3 gate) Ask the restaurant's accountant which tax mode applies, the GST rate, and whether prices include tax. Do not go live before this is answered.
- [ ] (Phase 4, Task 28) Pair the spare SIM with WA-AKG, create its API key, register the webhook, and verify the three endpoint paths against its `/docs` page; see `docs/WA-AKG.md`.
- [ ] (Phase 6) Real backup bucket, encryption key stored safely, restore drill on a fresh VPS; see `docs/RESTORE.md`.
- [ ] (Phase 6) Real-device QA and the pilot checklist with the first restaurant.
