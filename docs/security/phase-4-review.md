# Phase 4 Security Review

## Authentication & Authorization
- Public endpoints (`/book`, `/events`) enforce rate limits but allow anonymous access to prevent DoS.
- Form submissions use honeypot fields to mitigate automated bot spam.
- Action boundaries strictly enforce ownership or roles. `admin` endpoints enforce `STAFF` or `OWNER` roles.
- `Authorization` matrices explicitly tested for boundaries (`src/lib/auth/authz-matrix.int.test.ts`).

## Data Validation
- Strict validation schemas for bookings, packages, and enquiries via Zod, rejecting over-sized payloads.
- Phone numbers enforce specific length and patterns before passing to DB or outbox.

## External Interfaces (WhatsApp)
- The webhook rejects invalid signatures (`hub.verify_token`, or payload digest) returning 401.
- AI auto-reply relies on local prompt grounding. Does not execute user instructions. Price validation enforces hardcoded values.

## Rate Limiting & Resource Protection
- `rateLimit` middleware applies to all OTP request endpoints.
- OTPs expire in 10 minutes and use crypto RNG for 6-digit generation. Brute-force protection limits attempts.

## Retention & Privacy
- Data retention cron deletes chat histories older than 24 months.
- Cron endpoints are protected by `CRON_SECRET` using timing-safe comparisons to prevent unauthorized execution.
