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
- The webhook rejects invalid signatures (`x-webhook-secret` or token matched securely) returning 401 using `crypto.timingSafeEqual`.
- AI auto-reply relies on local prompt grounding. Does not execute user instructions. Price validation enforces hardcoded values and checks them against the facts prompt. It enforces a daily rate limit of AI messages per phone number, and a monthly overall usage limit.
- Webhook ignores Group and Broadcast messages to prevent information disclosure.
- Deduplication is implemented via unique constraint on `externalId` to prevent duplicate processing.

## Rate Limiting & Resource Protection
- `rateLimit` is DB-backed via the `RateHit` table, serializing operations across multiple environments using Postgres advisory locks.
- OTPs expire in 10 minutes and use crypto RNG for 6-digit generation. Brute-force protection limits attempts.
- Bookings use advisory locks on the date and previous date to ensure absolute serialization during capacity checks.

## Retention & Privacy
- Data retention cron deletes chat histories older than 24 months, OTPs older than 1 day, RateHits older than 2 days, and ErrorLog older than 30 days.
- Cron endpoints are protected by `CRON_SECRET` using timing-safe comparisons to prevent unauthorized execution.
- A "STOP" command immediately opts out users from marketing and cancels future interactions, adhering to privacy rules.
