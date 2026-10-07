# Handover & Operations Guide

## How to Run & Deploy
- App uses Next.js with Prisma and PostgreSQL.
- Local: `npm run dev`
- Production: `npm run build && npm start`
- Deploy via Docker Compose: `docker-compose -f docker-compose.prod.yml up -d`

## Environment Variables
- `NODE_ENV`: production
- `DATABASE_URL`: postgres connection string
- `APP_URL`: public accessible URL starting with https://
- `CRON_SECRET`, `OTP_SECRET`, `COOKIE_SECRET`, `WA_WEBHOOK_SECRET`: 32+ character secrets
- `BACKUP_ENCRYPTION_KEY`: 32 byte base64 encoded key
- `WHATSAPP_PROVIDER`: `wa-akg` or `fake`
- `AI_PROVIDER`: `gemini` or `fake`

## Cron Jobs
- Handled by a sidecar or cron loop pinging `/api/cron/alerts` and other cron routes using `CRON_SECRET`.

## Backups and Restore
- Offsite backups encrypted with `BACKUP_ENCRYPTION_KEY` sent to S3-compatible storage.
- Keep `BACKUP_ENCRYPTION_KEY` offline safely. Without it, backups are unreadable.
- See `RESTORE.md` for full disaster recovery drill.

## Secrets Ownership
- The restaurant owner holds the `BACKUP_ENCRYPTION_KEY` and the `CRON_SECRET` for sidecars.

## Module Map
- `/src/lib/orders`: Order placement, state machine, and board logic.
- `/src/lib/auth`: Accounts, session, password rules.
- `/src/lib/monitoring`: Health checks, error logs, alerting logic.
- `/src/lib/storage`: Backups and media.
- `/src/app/api`: HTTP boundaries.
