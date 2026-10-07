# Restore Drill

Follow these steps to restore the database and files on a fresh VPS.

## 1. Prerequisites
- A fresh VPS (e.g., Ubuntu).
- Docker and Docker Compose installed.
- The `BACKUP_ENCRYPTION_KEY` and S3 credentials.

## 2. Download the codebase
Clone the repository to the new VPS:
```bash
git clone <your-repo-url> /opt/restrosathi
cd /opt/restrosathi
```

## 3. Configure the environment
Copy the production environment example:
```bash
cp .env.production.example .env.production
```
Edit `.env.production` and fill in:
- The S3 credentials (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`).
- `BACKUP_ENCRYPTION_KEY`
- Database URL and other secrets (generate new random strings for `CRON_SECRET`, `OTP_SECRET`, `COOKIE_SECRET` etc.).

## 4. Run the Restore Script
Start the PostgreSQL container first to act as the target database:
```bash
docker-compose -f docker-compose.prod.yml up -d postgres
```

Wait a few seconds for it to be ready. Ensure `node` and `npm` are installed (you can use `nvm`).
Install dependencies:
```bash
npm ci
```

Find the object key of the latest backup in your S3 bucket (e.g. `restrosathi/2026/10/restrosathi-2026-10-07T03-00-00-000Z.tar.gz.enc`).

Run the restore script targeting the local database:
```bash
npx tsx scripts/backup/restore.ts "restrosathi/2026/10/restrosathi-2026-10-07T03-00-00-000Z.tar.gz.enc" \
  --target-db "postgresql://postgres:postgres@127.0.0.1:5432/restrosathi" \
  --files-dir "./uploads" \
  --confirm
```

If it successfully decrypts and restores, it will print row counts for the main tables.

## 5. Start the Application
Bring up the rest of the stack:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 6. Verification Checklist
- [ ] Website loads correctly at your domain.
- [ ] Login works (using an existing owner or staff account).
- [ ] You can view a recently settled bill.
- [ ] You can view uploaded files (e.g., a menu item photo).

---
*Sign-off after a real drill:*
**Date:** ___________
**Performed by:** ___________
**Result:** [ ] PASS [ ] FAIL
