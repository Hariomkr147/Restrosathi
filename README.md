# RestroSathi

Single-restaurant prototype for the fictional Saffron Tadka restaurant.
Scope and task contracts live in `docs/superpowers/`; read `AGENTS.md` before working.

Use Node.js 22 LTS and npm:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Verify the foundation with:

```bash
npm run lint
npm run typecheck
npm run test:unit
npx playwright install chromium
npm run test:e2e
```

E2E tests build and run the production app at desktop and 360 px widths.
PostgreSQL and the integration-test project are added in Task 2.
