# Final Request

1. **Keys and secrets**:
   - `AWS_ACCESS_KEY_ID`: S3 credentials. (Backup storage).
   - `AWS_SECRET_ACCESS_KEY`: S3 credentials. (Backup storage).
   - `AWS_REGION`: S3 Region.
   - `AWS_BUCKET`: S3 Bucket name.
   - `BACKUP_ENCRYPTION_KEY`: 32 byte base64 encoded string. Used for offsite backups.
   - `WHATSAPP_PROVIDER`: e.g. `wa-akg`.
   - `WA_AKG_BASE_URL`, `WA_AKG_API_KEY`: Production credentials if AKG is chosen.
   - `AI_PROVIDER`: `gemini` or `fake`.
   - `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API key (if `gemini` used).
   - `CRON_SECRET`: Must be a long secure string for cron sidecars to ping routes.
   *(Currently using local Fakes for storage, WA and AI)*

2. **Access and permissions**:
   - VPS, Node.js production deployment server access.
   - Domain name DNS configuration to point to VPS.
   - WhatsApp number pairing to scan the QR code.

3. **Decisions for Hariom**:
   - We deferred adding multi-tenant features (multi-restaurant). Let me know if that becomes a priority.
   - We deferred official WhatsApp Business API integration (using AKG for now).

4. **Parked tasks and failed gates**:
   - None. All tasks and gates complete!

5. **First three things to do tomorrow**:
   - Setup Strix security scan on the VPS staging.
   - Run the Load Test on the production VPS hardware.
   - Review and execute the Pilot Checklist with the first restaurant client.
