# Deploying RestroSathi on Botkeep.cloud

This guide explains how to deploy the fully functional core application on Botkeep using your Founder Plan (5 server slots, 2048 MB RAM, 1.5 CPU) while skipping real LLMs, WhatsApp SIMs, S3 buckets, and hardware.

---

## 1. Plan Allocation on Botkeep

Your 5 slots can be used as follows:
* **Slot 1: PostgreSQL 17 Database** (Managed Database)
* **Slot 2: RestroSathi Next.js Web App** (Node.js 22 runtime)

---

## 2. Step 1: Create the PostgreSQL Database Slot

1. In your [Botkeep Dashboard](https://botkeep.cloud/app), click **Create Service** or **New Server**.
2. Select **Database** -> **PostgreSQL 17**.
3. Allocate resources (e.g. 512 MB RAM / 0.5 CPU).
4. Once provisioned, copy your **Connection String / URI**:
   `postgresql://<user>:<password>@<internal-host>:<port>/<database>`

---

## 3. Step 2: Deploy the Web Application

### Option A — Direct from GitHub (Recommended)
1. In Botkeep, click **Create Service** -> **Deploy from GitHub**.
2. Connect your GitHub account and select repository: `Hariomkr147/Restrosathi`.
3. Choose branch: `phase-6-infrastructure`.
4. Configure the build & start commands:
   * **Runtime**: `Node.js 22`
   * **Build Command**: `npm run build` *(runs `prisma generate && next build`)*
   * **Start Command**: `npm run start:prod` *(runs `prisma migrate deploy && next start`)*

### Option B — Upload ZIP Archive
If deploying via direct upload:
1. Use the pre-built archive in your repo at: [`dist/restrosathi-botkeep.zip`](file:///c:/Users/Hario/Documents/Restrosathi/dist/restrosathi-botkeep.zip)
2. In Botkeep, select **New Service** -> **ZIP Upload**.
3. Set the start command to `npm run start:prod`.

---

## 4. Step 3: Configure Environment Variables in Botkeep

In your Web App slot on Botkeep, open the **Environment / Variables** tab and paste these values:

```env
DATABASE_URL="<paste-your-botkeep-postgres-connection-string-here>?schema=public"
NODE_ENV="production"
PORT=3000

# Standalone core modes (no external keys needed)
WHATSAPP_PROVIDER="fake"
AI_PROVIDER="fake"

# Demo Credentials
SEED_OWNER_PASSWORD="DemoOwner!2026"
SEED_STAFF_PIN="123456"

# App Secrets (pre-generated)
CRON_SECRET="rs_cron_secret_79f91a27e8a94cb2"
OTP_SECRET="rs_otp_secret_52a1d84b0f3e69ca"
COOKIE_SECRET="rs_cookie_secret_c38d4e92a10f76b1"

# Uploads & Rate Limiting
UPLOAD_DIR="./uploads"
RATE_LIMIT_IP_ORDERS_PER_HOUR="60"

# Public URL (update with your actual Botkeep assigned URL)
APP_URL="https://your-app.botkeep.cloud"
SITE_URL="https://your-app.botkeep.cloud"
```

---

## 5. Verification Checklist After Deploy

Once Botkeep finishes building:
* Visit `https://your-app.botkeep.cloud/` to see the live homepage.
* Check `https://your-app.botkeep.cloud/api/health` (should return `{"ok":true}`).
* Log into `/login` with `+919999900001` / `DemoOwner!2026`.
* Test `/t/T1` to place a QR order and view it on `/admin/board`.
