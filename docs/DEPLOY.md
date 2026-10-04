# Deployment Guide

1. **Provision VPS**: Get a VPS running Linux with Docker and Docker Compose installed.
2. **DNS Setup**: Point the A record for your domain (e.g. `demo.restrosathi.com`) to the VPS IP.
3. **Copy Files**: Copy this repository to the server.
4. **Environment Secrets**: 
   - Copy `.env.production.example` to `.env.production`.
   - Fill in strong passwords for `POSTGRES_PASSWORD`, `CRON_SECRET`, `SEED_OWNER_PASSWORD`, `SEED_STAFF_PIN`.
   - Never use the demo credentials (`demo` / `0000`) in production.
5. **Start Services**:
   - Run `docker compose -f docker-compose.prod.yml up -d --build`
6. **Initial Seed**:
   - Run `docker compose -f docker-compose.prod.yml exec app npm run db:seed`
   - This creates the initial owner and staff users using the secrets.
7. **Verify**:
   - Open `https://demo.restrosathi.com`
   - Check `https://demo.restrosathi.com/api/health` returns `{"ok":true,...}`
8. **Security Note**:
   - Change the staff PIN from the UI after initial deployment.
9. **Backups**:
   - Backups run nightly at ~03:00.
   - To restore, copy the `.sql.gz` from the `backups` volume, `gunzip`, and run `psql -U postgres restrosathi < file.sql` against the `postgres` container.
