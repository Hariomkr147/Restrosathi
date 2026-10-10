# Final Request

This document summarizes the current state of RestroSathi's Phase 6 (Infrastructure) repair process, what has been completed, and what is currently blocked requiring human intervention.

## 1. Keys and secrets I must provide
* **S3 / Floci credentials**: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `BACKUP_ENCRYPTION_KEY`
  * Requires real credentials for AWS S3 compatible storage before production launch.
* **Auth Secrets**: `CRON_SECRET`, `OTP_SECRET`, `COOKIE_SECRET`
  * Used for internal security and session management. Generate via `openssl rand -base64 32`.
* **WhatsApp Provider (AKG)**: `WA_AKG_API_KEY`, `WA_AKG_SESSION_ID`, `WA_WEBHOOK_SECRET`
  * Needs real device pairing (H03).

## 2. Access and permissions I must grant
* **Docker Desktop**: The host environment must have Docker Desktop restored and running to run test databases (`15432`), Floci, and production image verification.
* **Host Permissions (Windows/SWC)**: Resolving the Turbopack / DACL cache permissions blocking `npm run build` locally.

## 3. Decisions for Hariom
* **Local Test Environment**: Decide if local testing (using Turbopack) on Windows is strictly required, or if we can rely entirely on building the Next.js app within a Docker container to bypass local SWC/AppData cache errors. 
  * *Default*: We should build in Docker.
* **Production Deployment Environment**: Decide on the target VPS specifications and OS for staging and live.

## 4. Parked tasks and failed gates
* **R27 (UI verification, performance metrics)**: Parked due to local Next.js `npm run build` failing with an Application Control policy blocking the SWC native extensions (`ERR_DLOPEN_FAILED` / `ERR_SWC_NATIVE_CACHE` on Windows AppData). Unblocked by fixing host AppLocker/WDAC policy or building in Docker.
* **R28 (Final Gate / Audit)**: Failed to pass phase exit criteria because `127.0.0.1:15432` test database is inaccessible without Docker, and integration/e2e tests cannot run. Unblocked by restoring Docker Desktop.

## 5. First three things to do tomorrow
1. **Restore Docker Desktop** on the host environment and confirm `docker info` responds successfully.
2. **Resolve the Windows AppLocker/WDAC block** on SWC native extensions (or fallback to a Docker dev container) to allow `npm run build` and `npm run dev` to pass.
3. Once unblocked, **Run the queue** again to complete the parked tasks (R27, R28) and close the final gates.
