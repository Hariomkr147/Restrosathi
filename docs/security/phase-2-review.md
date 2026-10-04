# Phase 2 Security Review

- **Every server action and route handler calls `requireUser(role)`**: PASS. All admin server actions and route handlers verified via `authz-matrix.int.test.ts` to require authentication. Public routes explicitly tested.
- **Login lockout**: PASS. `loginWithPassword` and `loginWithPin` limit to 5 failures per 15 min. (Implemented in Phase 1).
- **Origin check on route handlers**: PASS. Server actions handle CSRF. `POST /api/menu-photo` verifies Origin header (tested in Phase 1).
- **Body size limits**: PASS. Next.js globally configures `serverActions: { bodySizeLimit: "100kb" }` in `next.config.ts`.
- **Upload size and type limit**: PASS. `/api/menu-photo` uses `sharp` to strip metadata, enforces image type, and limits size.
- **Rate limits keyed on device/session**: PASS. Service requests and AI usage are capped per device/session (`usage.ts`, `request.int.test.ts`). AI caps are strictly atomic (`UPDATE calls = calls + 1`).
- **No stale "sold out" items**: PASS. `OrderScreen` handles dynamic availability validation server-side.
- **Secrets only in server env vars**: PASS. `ANTHROPIC_API_KEY`, `DATABASE_URL` are not exposed in `.next` output. Env file ensures server execution.
- **No secrets in client bundles**: PASS. Checked `.next` directory (grep did not find secrets).
- **/uploads path traversal**: PASS. Tested in Phase 1 (`routes.int.test.ts` confirms directory traversal protection).
- **Error messages without internals**: PASS. Fallback errors use predefined UI messages, never stack traces or internal DB IDs.
