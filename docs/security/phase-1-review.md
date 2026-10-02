# Phase 1 security review

Code-level review against spec section 12. No external scanner or live-service test was run. Reviewed auth/session/login/rate-limit, settings and menu rules/actions, photo upload/serving, localization and public rendering.

| Control | Result and evidence |
|---|---|
| Authentication and roles | PASS: server-side guards precede validation/work. The 33-case authz matrix exercises every current protected action and mutating route as anonymous, staff and owner. Settings/menu editing are owner-only; availability/logout allow both roles. Layout guards also reject direct owner-page access by staff. |
| Public exceptions | PASS: password/PIN login establishes authentication, setLocale is a bounded pre-login preference, and validated menu-image GET serves diners. Exceptions are recorded in the matrix; route/upload tests cover public serving. |
| Credentials and sessions | PASS: salted scrypt hashes and timing-safe comparison; random 256-bit session tokens stored as SHA-256 hashes; active-user checks, 12-hour expiry and logout revocation. Auth integration tests cover invalid, inactive, expired and unknown sessions. |
| Login lockout | PASS for tested threshold: five logged failures per user or IP within 15 minutes lock that key for 15 minutes after the fifth. Tests cover both keys and correct credentials during lockout. No live brute-force/load result is claimed. |
| Cookies | PASS: session and locale cookies use httpOnly, sameSite=lax, path=/ and secure in production. Production session flags are tested. |
| CSRF | PASS: Next server actions retain the framework's Origin checks. Photo POST requires a matching Origin and owner session; cross-origin, anonymous and staff attempts are rejected in route tests. |
| Input and body limits | PASS: Zod remains on server trust boundaries; global actions retain 100KB limit. Photo POST caps streamed multipart data at 5MB plus 64KB envelope allowance, and image processing enforces the actual 5MB file cap. Content-Length is not trusted. |
| Image safety | PASS: content-based JPEG/PNG/WebP validation, bounded decode pixels, single-page input, orientation correction, maximum 1200px width, WebP re-encoding and metadata removal. Tests reject fake JPG, HEIC-like and oversized files. Filesystem errors do not expose internals to upload clients. |
| Upload paths | PASS: generated UUID filenames; GET accepts only the menu/UUID.webp shape and verifies resolved paths remain under UPLOAD_DIR. Traversal/unexpected paths are tested; responses have immutable caching and nosniff. |
| Menu validation and money | PASS: integer paise, exclusive base-price/variants, valid localized text, modifier bounds/options and enum values. Server pricing ignores client price fields. Nonempty categories cannot be deleted; foreign-key races remain guarded. |
| Audits and concurrency | PASS: settings updates and their audit rows are atomic. Menu price/availability writes audit before/after inside transactions; item replacement locks its parent row. Three repeated concurrent replacement checks produce one complete variant set. |
| Dynamic availability | PASS: public menu is dynamic and mutations revalidate it. Browser tests prove sold-out changes and exact owner-edited prices appear on a new public page. |
| Rendering and secrets | PASS: React escapes text, settings links require HTTPS, and JSON-LD escapes '<'. The client .next/static output contains none of DATABASE_URL, ANTHROPIC_API_KEY, SEED_OWNER_PASSWORD or SEED_STAFF_PIN. Test credentials are fictional; no real secret was committed. |
| Later-phase controls | NOT YET APPLICABLE: public ordering session/device rate limits, bookings, privacy/retention, WhatsApp and AI resilience remain in their planned phases. Feature flags keep bookings/events hidden. |

## Finding fixed during the gate

Modifier-group maximum accepted 2147483648 although PostgreSQL Int cannot store it, leading to a database failure instead of validation feedback. A failing schema test reproduced the issue; the shared schema now bounds the maximum at 2147483647. The focused test passes, with no gate weakened.

## Human verification

Physical Android QA is deferred at Hariom's request and recorded in HUMAN-TODO. HTTPS/proxy hardening and the owned-staging Strix run belong to Phase 2 deployment; they are not represented as completed here.
