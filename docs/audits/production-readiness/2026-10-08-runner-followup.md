# R01/R02 verification follow-up

Date: 2026-10-08, Asia/Kolkata. Starting revision: `0e1e991`, branch `phase-6-infrastructure`.

Fresh execution found defects despite the existing R01/R02 completion entries:

- ESLint failed with nine errors in the recent route, cron, concurrency and temporary-script changes. These were fixed with typed errors, real request objects or a narrowly typed request stub, and discriminated result narrowing. No rule was disabled.
- Linux `npm ci` failed with `EBADPLATFORM` because `@swc/core-win32-x64-msvc` was a required direct dependency. Removed that direct dependency; the existing SWC packages retain their platform-specific optional dependencies. Linux installation now succeeds.
- Playwright collection could not resolve the Next server import used by fixtures. The E2E command now uses the already installed `tsx` loader. `npm run test:e2e -- --list` collects **158 tests in 32 files**.
- The isolated server now sets APP_URL and SITE_URL to its own origin on port 3001. Docker's env-file syntax does not strip dotenv quotes; the verification invocation supplies fictional seed credentials explicitly.
- Docker contexts now exclude local agent/runtime/cache folders. No machine ACLs were changed. Windows Next's native cache rejected existing ancestor permissions; verification moved to Node **22.23.3** in Linux Docker.

Checks observed on the repaired working tree:

| Command | Result |
|---|---|
| `npm run lint` | Exit 0; 0 errors, 24 existing warnings. |
| `npm run typecheck` | Exit 0. |
| `npm run test:unit -- src/lib/billing src/lib/loyalty src/lib/cron.test.ts` | Exit 0; 29 passed in 5 files. |
| `npm run test:int -- src/lib/billing/redemption-regeneration.int.test.ts src/lib/loyalty/loyalty.int.test.ts src/app/api/orders-route.int.test.ts` | Exit 0; 27 passed in 3 files at that revision. |
| Linux `npm ci` | Exit 0. |
| Linux production build through E2E webServer | Successful; both browser tests started and passed. |

The temporary verification image combined Node 22.23.3 with the installed Playwright 1.63.0 browser image, ran `npm ci` and `prisma generate`, and copied source into its Linux filesystem. A first bind-mounted cold build exceeded the unchanged 120-second startup timeout. Copying source rather than mounting it resolved that environmental delay. No response-time or startup gate was relaxed.

This does not certify the full R01/R02/R28 gates. The owner dashboard still throws an invalid-date Prisma error after login; admin navigation has missing/corrupt Hindi labels. Both were observed during the passing bill checks and remain open for R08/R16/R27. Dependency installation still reports eight high-severity findings; R03/R17/R19/R28 must reconcile them with current reachability and fixes before release.
