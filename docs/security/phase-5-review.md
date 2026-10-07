# Phase 5 Security and Privacy Review

## Erasure Completeness
The erasure mechanism (`eraseCustomer`) covers:
- `Customer` table (anonymized/deleted)
- `ConsentRecord` table
- `Bill` (anonymized names/phones)
- `Booking` (anonymized names/phones)
- `EventEnquiry` (anonymized names/phones)
- `MessageLog` (anonymized phones and body)
- `Feedback` (cleared customerId)
- `DiningSession` (anonymized customerName/Phone)
- `OptOut` rows are kept strictly to enforce blocking.

## Consent and Marketing
- Consent is strictly opt-in or requested at the point of physical action (billing/booking).
- Revoking consent appends a new record; latest record wins.
- The single source of truth for the marketing list is `getMarketingAudience()`.
- STOP handling via WhatsApp strictly records a denial.
- Marketing uses explicit `wa.me` links. The application code never uses the WhatsApp automated `notify` provider to bulk-send marketing.

## Auditing and PII
- No PII is included in `audit()` logs. The customer ID is used without phone numbers or names.
- Feedback token is 32-byte secure random, expiring in 7 days, preventing brute force guessing.

## Locking and Concurrency
- Bill settlement follows strict lock order: `session lock -> bill row -> customer row -> invoice counter` to prevent race conditions during loyalty point generation.
