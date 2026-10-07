# RestroSathi — complete plan audit
Date: 2026-10-07  
Audited revision: `79e4723` on `phase-6-infrastructure`  
Scope: Tasks 1–47, phase gates, spec/product/design constraints, implementation, tests, deployment scripts and completion records. Ponytail level: full.

## Verdict

**The repository is not complete against the plan and is not ready for deployment or the pilot.** There is substantial working foundation/menu/order/billing code, but the current production build fails and important later features are incomplete. “All tasks and gates complete” in FINAL-REQUEST is contradicted by both fresh execution and the source.

This is an audit, not a repair pass. Application code, original tests, authoritative plans and progress records were not edited. Only this report and audit evidence were added. No commits, deployments, real messages or live security scans were performed. Integration checks used the designated test database; they reset/seed that database through the existing guarded setup.

P1 means a release-blocking correctness, security or required-deliverable defect. P2 means a material defect that also needs resolution before claiming the affected task/gate complete. Findings marked **probe** were reproduced using actual functions with mocked boundaries; **inspection** findings are source-based and are not presented as completed end-to-end reproductions.

## Fresh verification

| Check | Observed result |
|---|---|
| `npm run lint` | Failed: 22 errors, 98 warnings. |
| `npm run typecheck` | Failed. Independently repeated with Node 22.23.3 in Docker: **51 TypeScript diagnostics**. |
| `npm run build` | Failed during TypeScript validation after compilation; no successful production build established. |
| `npm run test:unit` | **165 passed, 1 failed**; 30 passing files, 1 failing file. |
| `npm run test:int` | **327 passed, 55 failed, 14 skipped**; 36 passing files, 18 failing files. |
| `npm run test:e2e -- --list` | Failed at collection: missing `next/headers` resolution and `tests/e2e/helpers`; **0 tests collected**. |
| `npm audit --omit=dev --json` | 3 high and 1 moderate affected-package entries; no critical entries. These are dependency findings, not proof of application exploitability. |
| Restore CLI smoke check, without restore arguments | Failed before argument validation: `ReferenceError: require is not defined in ES module scope`. |
| Isolated audit diagnostic probes | **9/9 reproduced the defects they assert. This is not an acceptance-test pass.** |
| Load, real restore, browser accessibility, Hindi/360 px, production JS budget | Not certified. The load harness is a stub; restore/build/browser collection blockers prevent a valid gate result. |

Host Node was 24.19.0. To distinguish environment differences from repository defects, typechecking was also run against the required Node 22 in Docker and failed with the same substantive source errors. Other host results should be repeated in the fixed Node 22/browser environment after repairs. No gate was changed to accommodate Windows.

Raw logs: [Node 22 typecheck](./2026-10-07-evidence/typecheck-node22.txt), [build](./2026-10-07-evidence/build.txt), [integration](./2026-10-07-evidence/integration.txt), [E2E discovery](./2026-10-07-evidence/e2e-discovery.txt), [dependency audit](./2026-10-07-evidence/dependency-audit.json), [restore CLI](./2026-10-07-evidence/restore-cli.txt), [diagnostic output](./2026-10-07-evidence/probes.txt). Lint and unit counts above are from the actual command outputs observed during this audit; full transcripts were not saved.

Reproduce isolated diagnostics: `npx vitest run --config docs/audits/2026-10-07-evidence/probes.config.mjs`. They use no real network or database. Do not include them in the acceptance suite as “passing feature tests”: they intentionally assert current incorrect behavior.

## Findings

### F01 — P1: The current application cannot pass its production build

**Tasks 1, 37, 38, 40, 44, 46, 47; all current full gates. Evidence: execution.**

The 51 Node 22 diagnostics include nonexistent Prisma fields/relations, nonexistent password-helper exports, incompatible OTP call signatures, and missing test modules. These are not merely formatting issues. Examples: `prisma.session` instead of `diningSession`; `Customer.bills` and `Customer.bookings` relations absent from the schema; `generateHash`/`verifyPassword` imports absent from the password module. The Next build also fails.

**Required correction:** implement against the real schema and existing APIs, then pass typecheck and production build without suppressions or excluding failing source. [Typecheck evidence](./2026-10-07-evidence/typecheck-node22.txt).

### F02 — P1: Bill generation and redemption mutations do not share settlement's locks

**Tasks 22, 23, 38. Evidence: inspection of concurrent execution paths.**

[generateBill](../../src/lib/billing/generate.ts:33) reads the session, orders and bill without `lockSession` or a bill row lock, then replaces bill lines/totals. [Settlement](../../src/lib/billing/settle.ts:25) locks the session and bill, but that does not serialize a generator which ignores those locks. An order inserted between the generator's read and its later `generatedAt` timestamp can be absent from the bill while also escaping settlement's `placedAt > generatedAt` stale check. A generator which previously read OPEN can also update after settlement.

[applyRedemption/removeRedemption](../../src/lib/loyalty/index.ts:65) perform read/check/recompute/update outside a transaction and can similarly overwrite totals after a concurrent settlement.

**Required correction:** share the documented session → bill → customer locking order, re-read status inside the lock and add real generation/order/settlement/redemption races. Preserve immutable settled snapshots.

### F03 — P1: Regenerating a redeemed bill drops the discount but retains the points debit

**Task 38. Evidence: probe plus settlement trace.**

[generateBill's calculation](../../src/lib/billing/generate.ts:76) omits `extraDiscountPaise`, while its write retains `loyaltyPointsRedeemed` and `loyaltyDiscountPaise` at lines 117–118. A probe with a 20,000-paise subtotal and a 100-point/5,000-paise redemption produced a regenerated total of **20,000 paise and zero total discount**, while retaining both redemption fields. Settlement subsequently uses the retained points count.

Changing the customer phone can also retain the old redemption fields despite clearing verification.

**Required correction:** recompute manual and loyalty discounts together from a valid draft and clear/revalidate redemption when its customer/verification changes. Test regenerate → settle and phone-change paths.

### F04 — P1: OTP, booking and auto-reply notification parameters disagree with their templates

**Tasks 29–32, 34. Evidence: probes and failing integration tests.**

[Templates](../../messages/en.json:485) require `otp`, `date/pax`, and `answer`. Callers supply `code`, `partySize/time`, and `text`. [renderMessage](../../src/lib/whatsapp/notify.ts:51) throws for missing parameters. The actual renderer reproduced missing-parameter errors for OTP, BOOKING_RECEIVED and AUTO_REPLY. Confirmation has the same date/pax mismatch. An OTP request can therefore appear successful without delivering a usable code; outbox retries cannot repair malformed payloads.

**Required correction:** align every message producer with both locale templates; exercise actual producer → outbox → renderer → fake-provider flows. Include booking cancel links and IST date/time.

### F05 — P1: Monitoring is publicly callable; cron authentication also fails open when unset

**Tasks 32, 45 and security gates. Evidence: probe and inspection.**

[GET /api/cron/alerts](../../src/app/api/cron/alerts/route.ts:7) has no authentication. It returns internal check details, updates AlertState and can trigger owner notifications. The unauthenticated probe returned HTTP 200 with internal health results.

[Reminders](../../src/app/api/cron/reminders/route.ts:14) checks the token only when `CRON_SECRET` is nonempty; any Authorization header passes when it is absent. Feedback-themes/weekly routes compare against a literal interpolated undefined secret rather than failing closed. The required protected `/api/health/deep` route is absent. Alerts also use one four-hour `system_down` key and direct provider sends, contrary to the required per-key six-hour transactional outbox behavior.

**Required correction:** use the existing cron guard, fail closed on missing configuration, use POST for mutations, implement protected deep health and the planned alert evaluation/outbox tests.

### F06 — P1: Production cron cannot deliver the queued outbox

**Tasks 19, 29, 42, 45. Evidence: deployment/route inspection.**

[Compose cron](../../docker-compose.prod.yml:88) calls the outbox using GET, but [the route](../../src/app/api/cron/outbox/route.ts:5) exports POST only. It calls nonexistent `/api/cron/health` and schedules neither alerts nor weekly reports. Errors are swallowed with `|| true`. Queued messages depending on that worker will not be sent.

**Required correction:** match scheduled methods and paths to real authenticated handlers; add a local production-Compose smoke check proving a queued fake message is drained and each required periodic job is invoked.

### F07 — P1: OTP verification is broken at the billing/table integration points and is not atomic

**Tasks 30, 37, 38. Evidence: typecheck and inspection.**

[verifyBillPhoneAction](../../src/app/admin/bills/actions.ts:62) omits the required verification context; `verifyOtp` dereferences `ctx.now`. [The table action](../../src/app/t/[code]/actions.ts:35) reads `verifyRes.phone`, although success returns only `{ok:true}`; the verified phone is not actually written.

[OTP issuance](../../src/lib/otp/index.ts:30) never uses `ctx.ip` to enforce the planned IP limit, and count-then-insert races the phone limit. Verification reads attempts and consumption separately from its updates: simultaneous wrong attempts can overwrite each other's counts, and simultaneous correct attempts can both accept the same code.

**Required correction:** use the canonical phone normalizer, propagate the verified identity correctly, and atomically enforce issuance limits, attempt counts and single consumption. Test real public/staff flows with fake delivery.

### F08 — P1: Booking slot dates depend on the server's timezone

**Task 31. Evidence: probe with TZ=UTC.**

[bookableSlots](../../src/lib/bookings/slots.ts:36) creates IST midnight, then uses host-local `getDay` and `setHours`. In a UTC process, a request for 2026-10-08 with 11:00 opening generated a first slot of **2026-10-07T11:00Z**, instead of **2026-10-08T05:30Z**. It can also select the wrong weekday's hours.

**Required correction:** do calendar and opening-hour calculations consistently in Asia/Kolkata independent of host timezone. Cover UTC/IST hosts, overnight openings, cutoff and day boundaries.

### F09 — P1: Booking confirmation ignores overlapping bookings from the prior IST date

**Task 32. Evidence: inspection.**

[confirmBooking](../../src/lib/bookings/confirm.ts:38) queries only bookings whose start is on the target date. A 23:30 booking also consumes the next day's 00:00/00:30 slots, but a 00:00 request on that next day will not count it. Date-scoped locks do not serialize those overlapping dates. The booking is also checked before acquiring the lock and is not re-read after it, contrary to the task contract.

**Required correction:** account for every overlapping occupied slot and coordinate the locks for overnight overlap; re-check REQUESTED state after acquiring locks. Add cross-midnight and same-booking concurrent confirmation tests.

### F10 — P1: Consent persistence escapes the business transaction, and billing drops the checkbox

**Task 37. Evidence: inspection.**

[Booking](../../src/lib/bookings/request.ts:114) and [settlement](../../src/lib/billing/settle.ts:90) call `recordConsent` inside transactions, but [recordConsent](../../src/lib/customers/consent.ts:13) uses the global Prisma client. If that transaction just created the customer, the separate connection cannot see the uncommitted parent; the FK write can fail or wait until the original transaction times out. For existing customers, consent is still outside the enclosing operation's atomicity.

Separately, `generateBill` stores the checkbox on the bill, while [settleBillAction](../../src/app/admin/bills/actions.ts:36) passes only expectedTotalPaise and settlement reads only `opts.marketingConsent`. Normal UI settlement does not append the selected consent record.

**Required correction:** pass the transaction client through the consent helper and use the saved bill consent in the settlement contract. Test both new and existing customers, rollback, unchecked consent and the full billing UI path.

### F11 — P1: Backup/restore does not provide a working, verified recovery path

**Task 44. Evidence: CLI execution and inspection.**

[restore.ts](../../scripts/backup/restore.ts:177) and [run.ts](../../scripts/backup/run.ts:132) use `require.main` in this ESM package. The no-argument restore smoke check fails with `require is not defined`.

Even after fixing entry-point detection, restore reads/validates `--files-dir` at line 56 but never restores files there: it extracts to a temporary directory, restores only the database, then deletes the directory. Uploads/session files are lost from the restored installation. Backup catches an upload/retention failure, writes a failed BackupRun, resolves normally, and its CLI success branch exits zero.

**Required correction:** make the CLI runnable, return nonzero for backup failures, restore both database and files into explicit scratch destinations, and complete the planned Floci round-trip/hash/failure tests. The existing “pg_dump unavailable” early return is not a completed restore drill.

### F12 — P1: Growth AI bypasses the fake, quota, privacy and output-validation boundary

**Tasks 41, 43. Evidence: inspection.**

[Feedback reply action](../../src/app/admin/feedback/actions.ts:18), [feedback themes](../../src/app/api/cron/feedback-themes/route.ts:26), and [campaign drafting](../../src/app/admin/customers/actions.ts:27) call the Google SDK directly. They do not use the shared provider/fake or monthly cap. Raw feedback comments go into prompts without the planned phone/email/handle stripping. Replies/drafts lack the required forbidden-offer, URL and length validation and fallback. STAFF is permitted where the plan requires OWNER.

Feedback themes are only logged/returned; there is no planned FeedbackSummary persistence, indexed evidence/count validation or fewer-than-five-comments fallback. Campaign drafting explicitly requests a generic special offer without an owner's substantiating goal. The existing shared provider selector also ignores explicit AI_PROVIDER=fake when an OpenRouter key is configured outside NODE_ENV=test; repair that selection before relying on production-build test fakes.

**Required correction:** route these paths through the existing provider/quota boundary with redaction and task-specific validated outputs; implement owner authorization, deterministic fakes and the specified fallback behavior. Do not count a thrown provider error as a passing authorization test.

### F13 — P1: Marketing recipients bypass the opt-out exclusion

**Tasks 37, 43. Evidence: inspection.**

[Customer list](../../src/app/admin/customers/page.tsx:41) calculates eligibility from the latest consent row and offers SendPromoButton on that basis. It never uses [getMarketingAudience](../../src/lib/customers/consent.ts:33), the required single recipient source, or checks OptOut. A STOP-retained phone with a later granted record can reappear. This is an additional defect beyond the page's current Prisma error.

Task 43's campaign/segment/recent-contact/mark-sent workflow and Campaign/CampaignSend models are absent. A generic draft box and individual link do not satisfy that contract.

**Required correction:** complete the owner campaign workflow using the canonical audience, narrow it by segment/recent sends, and test STOP after a campaign is opened.

### F14 — P1: The owner dashboard crashes and omits most of its required facts

**Task 40. Evidence: typecheck and inspection.**

[Admin dashboard](../../src/app/admin/page.tsx:46) calls nonexistent `prisma.session.count`. Its constructed date uses unpadded numeric month/day in an ISO-like string, and seven-day average paise may be fractional although `formatINR` rejects non-integers. Aggregates use generatedAt instead of the planned settlement window. Top dishes, 24 busy-hour buckets with accessible table, upcoming bookings, AI warning and WhatsApp status are missing; the required tested dashboard query module is absent.

**Required correction:** implement the planned facts against the schema with integer rounding and IST settlement windows, then render/test the specified accessible dashboard.

### F15 — P1: The load-test gate is unsupported by an executable load test

**Task 46. Evidence: source/artifact comparison; no load run attempted.**

[run.ts](../../scripts/loadtest/run.ts:65) explicitly says it is a stub. It starts no server, sends no orders, polls no board and calculates no measured latency/error/concurrency results. Its JSON contains zero orders and zero polls. Earlier setup also writes nonexistent table fields, uses incompatible hex session tokens and deletes broad table contents.

Nevertheless [the recorded result](../loadtest/results-2026-10-07.md:1) claims 142 orders, 300 polls and passing percentiles, labelled “Simulated.” Those numbers cannot be produced by this harness and are not evidence of the required measured gate. The plan's run/results boxes are ticked.

**Required correction:** implement the actual guarded isolated-database HTTP workload, produce raw JSON and human-readable measured results with machine details, and pass the original thresholds. Validate the database name through URL parsing before any destructive setup.

### F16 — P1: Account management is a placeholder, including its supposed verification

**Task 47. Evidence: source and typecheck.**

[Staff page](../../src/app/admin/staff/page.tsx:25) and [account page](../../src/app/admin/account/page.tsx:12) contain comments where add/reset/deactivate/password forms should be. The planned staff actions file is absent. [Account logic](../../src/lib/auth/accounts.ts:3) imports nonexistent hash/verification helpers and writes incompatible audit fields.

[Account integration test](../../src/lib/auth/accounts.int.test.ts:10) has an empty body. [Account E2E](../../tests/e2e/accounts.spec.ts:4) creates two blank browser contexts and performs no login, action or assertion.

**Required correction:** wire the real forms/actions to the existing password/session/audit primitives and prove staff creation/login/reset/deactivation plus password change/session revocation.

### F17 — P1: Preflight reports unsafe incomplete configurations as passing

**Task 47. Evidence: probe and inspection.**

[checkPreflight](../../scripts/preflight-checks.ts:20) deliberately omits demo-password/PIN verification. It omits required address/contact/hours validation and ALLOW_FAKE_WA rejection; an unset WhatsApp provider passes `undefined !== "fake"`. The probe passed an otherwise filled snapshot with missing contacts/hours, arbitrary owner hash, no provider, and ALLOW_FAKE_WA=1.

The script counts all menu items instead of available items. [Its catch](../../scripts/preflight.ts:44) logs fatal errors without setting a failing exit status.

**Required correction:** implement every planned check against the real snapshot, including credential verification, and return nonzero for failed checks or operational exceptions.

### F18 — P1: Claimed gate coverage includes placeholders, weakened scenarios and broken fixtures

**Tasks 10, 23, 39, 44, 47; Gates 3–6. Evidence: test inspection and fresh runs.**

[Phase 5 exit](../../tests/e2e/phase-5-exit.spec.ts:4) only asserts true. Feedback E2E is also a placeholder. Account tests are empty (F16). [Billing cycle](../../tests/e2e/billing-cycle.spec.ts:11) skips the mobile viewport, and the settlement concurrency test exercises ten settlements against the plan's twenty. [Backup integration](../../scripts/backup/backup.int.test.ts:84) returns normally when pg_dump is absent, which records a pass without doing the restore.

[Authorization matrix](../../src/lib/auth/authz-matrix.int.test.ts:253) swallows every campaign error, including AuthError, and expects owner account actions to throw generic errors; implementation failures can satisfy those assertions. It does not prove protected alerts/deep health.

Full integration execution also exposes stale cleanup order: new Feedback/Payment/Loyalty dependencies cause foreign-key failures when tests delete bills/orders. The one unit failure concerns a live-clock 35-day retention boundary; it should use a fixed clock, not a relaxed expectation.

**Required correction:** restore the exact planned scenarios, real assertions and complete fixture cleanup. A failed or unexecuted gate must be recorded as such. Re-run the original commands after repairs; do not suppress failing tests.

### F19 — P2: Public order wrapper accepts deceptive origins and unbounded JSON

**Task 46; request-validation constraints. Evidence: two probes.**

[Order route](../../src/app/api/t/[code]/orders/route.ts:10) uses `origin.includes(host)`. A request with Host restaurant.example and Origin `https://restaurant.example.attacker.example` passed this check and reached placeOrder. The same route read and forwarded a 110,000-character JSON payload without the required 100 KB request-boundary cap.

**Required correction:** parse and compare the complete expected origin/host, including protocol/port policy, and enforce the body cap before parsing. Keep the shared business validation and rate limits.

### F20 — P2: Weekly reports do not implement the scheduled, idempotent weekly contract

**Task 42. Evidence: inspection.**

[Weekly route](../../src/app/api/cron/weekly-report/route.ts:18) sends on every authenticated invocation, using a rolling seven-day generatedAt aggregate. There is no Monday 09:00 IST guard, previous-week window, WeeklyReportLog/transactional deduplication or owner test-report page. Most required facts are omitted; money is formatted directly rather than with formatINR. Compose does not schedule it (F06).

**Required correction:** implement the planned deterministic facts, week window, owner locale, transactional once-per-week queueing and tests for concurrent calls/boundaries.

### F21 — P2: Menu assistant gives the model zero prices for ordinary base-priced items

**Task 18. Evidence: probe.**

[Assistant context](../../src/lib/ai/assistant.ts:51) uses `m.variants[0]?.pricePaise ?? 0` rather than basePricePaise for items without variants. A base-priced 18,000-paise dish became zero in both provider context and returned recommendation metadata. The rendered menu card may obtain its price separately; this finding concerns AI grounding and result metadata.

**Required correction:** reuse the existing canonical price selection and cover base-priced and variant-priced menus with the fake provider.

### F22 — P2: Backup chunks authenticate independently, not as one ordered file

**Task 44. Evidence: probe.**

[Crypto format](../../scripts/backup/crypto.ts:51) authenticates each random-IV chunk but does not bind a per-file identifier, sequence number or authenticated final marker. Swapping two complete encrypted 1 MiB frames still decrypts successfully with the plaintext chunks reversed.

The SHA-256 sidecar detects accidental corruption if trustworthy. An attacker able to replace both object and sidecar can rewrite that hash, so it does not provide keyed whole-file integrity. This finding does not claim loss of confidentiality or that every reordered compressed archive remains usable.

**Required correction:** authenticate file identity, chunk ordering and completion within the streaming format; add frame-reorder, splice and early-end tests alongside existing round-trip/bit-flip tests.

### F23 — P2: New surfaces violate localization/token rules, with no current visual gate evidence

**Tasks 37–47; bilingual/design constraints. Evidence: inspection; browser verification blocked.**

[Customers](../../src/app/admin/customers/page.tsx:46), [staff](../../src/app/admin/staff/page.tsx:20), [account](../../src/app/admin/account/page.tsx:8), and [dashboard](../../src/app/admin/page.tsx:74) contain hardcoded English labels. New screens use palette utilities such as bg-white/text-gray-500/text-green-600/text-red-600 rather than the project theme tokens. English/Hindi JSON key parity cannot detect untranslated hardcoded UI.

**Required correction:** finish the required strings and design-token use, then run actual Hindi/long-text/360 px, touch-target and axe checks for every new surface. Historical menu screenshots do not certify the later screens.

### F24 — P2: Completion and deployment handover records are unreliable

**Queue, progress, final handover. Evidence: document/source comparison.**

FINAL-REQUEST claims all tasks/gates complete despite the failures above. QUEUE has malformed Tasks 33–35 rows and unchecked later work; plan checkboxes and progress disagree. Exact machine-readable PROGRESS headings are missing for Task 19 and several Phase 4 entries, no valid Phase 4 summary was found, and parts of PROGRESS/HUMAN-TODO contain NUL/encoding corruption.

The handover requests AWS_* variables, while [backup configuration](../../scripts/backup/s3.ts:4) reads S3_*. It requests WA_AKG_BASE_URL while [the adapter](../../src/lib/whatsapp/wa-akg.ts:15) reads WA_AKG_URL and WA_AKG_SESSION_ID. AI configuration is split between the OpenRouter wrapper and direct Google calls. Do not provision services using the current final request alone.

**Required correction:** after actual verification, append accurate superseding progress entries and a corrected handover with the exact supported variables, real failed gates and outstanding human steps. Do not retroactively claim measurements.

### F25 — P2: Dependency findings remain untriaged

**Phase 6 security gate. Evidence: npm registry audit output.**

The fresh production dependency audit reports three high affected-package entries in the deepmerge-ts → @prisma/config → prisma chain and one moderate next-intl entry. These counts include transitive propagation and are not four independent exploits. The phase security note about avoiding extraneous dependencies does not resolve vulnerability advisories.

**Required correction:** review reachability/fixed versions and update or explicitly justify each advisory, then rerun audit/build/tests. No automatic dependency changes were applied.

### Additional privacy gap

[getSessionLoyaltyBalanceAction](../../src/app/t/[code]/actions.ts:42) accepts an arbitrary phone without binding it to a verified device/session. Once the application builds, a caller can query another phone's balance. Bind the read to the OTP-verified session. Also extend the erasure model-coverage inventory for LoyaltyTxn and Feedback: [HANDLED_MODELS](../../src/lib/customers/erase.ts:5) was not updated as Tasks 38/39 require. Database cascade/set-null behavior exists, so this audit does **not** claim those two relationships alone make erasure fail; the explicit coverage guarantee is incomplete.

## Task-by-task reconciliation

“Present” means substantive implementation was found, not fresh acceptance certification. No current phase is certified end to end because the full gates are red. Earlier historical passes are not invalidated retroactively; they simply do not certify this HEAD.

| Task | Contract | Current assessment |
|---|---|---|
| 1 | Skeleton, tokens, money, CI | Present; current lint/typecheck/build fail (F01). |
| 2 | Database, settings, audit | Present; migrations/test seed ran; newer code misuses schema/audit APIs. |
| 3 | English/Hindi | Foundation present; later hardcoded screens regress the contract (F23). |
| 4 | Password/PIN auth | Core scrypt/session/guard implementation present; later accounts incomplete (F16). |
| 5 | Menu model/pricing | Substantial schemas/server pricing and tests; keep canonical pricing. |
| 6 | Public menu | Implemented; current browser/budget/360 px gate not executed successfully. |
| 7 | Home/SEO/flags | Implemented; current visual/SEO regression suite blocked. |
| 8 | Settings editor | Implemented; full browser acceptance blocked. |
| 9 | Menu editor/uploads | Substantial validation, image decoding/limits and editing; current browser gate blocked. |
| 10 | Accessibility/performance/Hindi gates | Tests/artifacts exist; no fresh passing full gate (F18/F23). |
| 11 | Tables/QR | Implemented; current E2E unavailable. |
| 12 | Dining sessions | Database uniqueness and locking present; later generator must join lock discipline (F02). |
| 13 | Order placement | Substantial server-pricing/idempotency/rate-limit logic; later HTTP wrapper has F19. |
| 14 | Order states/voids | Substantial implementation/tests; cross-flow money races remain (F02). |
| 15 | Customer table | Implemented; new rewards integration broken (F07/privacy gap); browser gate blocked. |
| 16 | Staff board | Implemented; fresh integration cleanup failures and browser blocker prevent certification. |
| 17 | KOT print | Present; unchecked queue entry and current print E2E not certified. |
| 18 | AI menu assistant | Provider/quota/fallback present; base-price grounding defect (F21). |
| 19 | Production packaging | Files present, but build and scheduled worker configuration broken (F01/F06); progress gap. |
| 20 | Staff/takeaway orders | Substantial implementation; full integration/E2E gate red. |
| 21 | Billing/tax engine | Integer-paise calculation coverage present; preserve it during repairs. |
| 22 | Bill generation/snapshots | Unsafe concurrency and redemption regeneration (F02/F03). |
| 23 | Invoice settlement | Locks/counter/payment logic present; later consent/feedback/loyalty integration needs repair and real races. |
| 24 | Cancel settled bill | Implemented with reversal path; complete current regression verification unavailable. |
| 25 | 80 mm bill | Existing print path present; later feedback QR/loyalty details need contract verification. |
| 26 | Day-end | Implemented; integration setup failures prevent current acceptance proof. |
| 27 | Customer bill snapshot | Present; immutable-snapshot guarantee undermined by F02. |
| 28 | WhatsApp adapter/webhook | Adapter/fake/phone/webhook code present; handover variables disagree. |
| 29 | Outbox/cron/banner | Outbox present; producer/template mismatch and production cron break delivery (F04/F06). |
| 30 | OTP/device cookie | Present but limits, consumption and UI contracts broken (F04/F07). |
| 31 | Booking request | Present; UTC-host dates and consent path defective (F08/F10). |
| 32 | Booking management | Present; overnight capacity, state re-read, messages and auth problems (F04/F05/F09). |
| 33 | Events/enquiries | Screens/rules present; current acceptance and valid progress entry not established. |
| 34 | Grounded auto-reply/inbox | Code present; AUTO_REPLY rendering fails (F04), current flow not accepted. |
| 35 | Escalations | Code/cron present; integration failures and no verified delivery gate. |
| 36 | Privacy/retention/flags | Code present; current full retention/privacy regression evidence incomplete. |
| 37 | Customers/consent/erasure | Invalid page relations, dropped/non-atomic consent and incomplete erasure inventory (F01/F10). |
| 38 | Loyalty ledger | Ledger/schema present; regeneration, verification and concurrency defects (F02/F03/F07). |
| 39 | Feedback/review link | Token/conditional submit/rate-limit implementation present; planned integration/E2E coverage incomplete (F18). |
| 40 | Owner dashboard | Broken runtime query and missing required analytics (F14). |
| 41 | Feedback AI | Partial replacement without planned privacy/quota/validation/persistence (F12). |
| 42 | Weekly report | Partial route; scheduling, idempotency, facts and owner page absent (F06/F20). |
| 43 | Marketing campaigns | Partial draft/link UI; campaign models/workflow absent and audience unsafe (F12/F13). |
| 44 | Off-site backup/restore | Crypto/S3/scripts exist; CLI/restore/exit semantics and integrity defects; no verified drill (F11/F22). |
| 45 | Monitoring | Checks/system screen exist; unauthenticated mutation, wrong alert semantics and missing deep health (F05/F06). |
| 46 | Load gate | Stub, unsupported simulated result artifact, unsafe wrapper validation (F15/F19). |
| 47 | Accounts/preflight/pilot | Documentation exists; account forms/tests incomplete and preflight insufficient (F16/F17/F18). |

## What is worth retaining

The repository has useful foundations: integer-money formatting, bilingual fallback/parity infrastructure, validated menu pricing, content-decoded upload limits, scrypt credentials and hashed session tokens, database-enforced active-session uniqueness, order idempotency/state handling, and settlement/invoice locking. The fresh runs still passed 165 unit and 327 integration cases. This supports repairing the implementation against the existing contracts rather than rewriting the project. Passing counts alone do not establish the missing end-to-end behavior.

Real-domain/VPS access, WhatsApp pairing, real-bucket credentials and restore drill, authorized staging Strix, printer/phone QA and pilot sign-off remain human work. They do not explain missing code, fake tests or a nonfunctional local load harness.

## Ponytail audit — full level

Smallest useful complexity reductions, ranked by likely code removed. None removes planned scope, validation, authentication, authorization, logging, transactions, accessibility or tests.

1. **reuse:** duplicated bill recomputation in [applyRedemption/removeRedemption](../../src/lib/loyalty/index.ts:65). Replace the duplicated read/discount/calculate/write body with one internal locked draft-update path shared by both operations. Retain the distinction between apply validation and remove behavior. Estimated net reduction: 40–60 lines.
2. **reuse:** repeated hand-written cron authentication in [cron routes](../../src/app/api/cron). Use [verifyCronSecret](../../src/lib/cron.ts:3) consistently, with byte-safe token comparison and missing-secret refusal. Estimated net reduction: 15–25 lines. This also closes F05's inconsistent guards.
3. **reuse:** separate Prisma clients in booking modules. Use [the existing singleton](../../src/lib/db.ts) in confirmation/cancel/status/reminders instead of creating independent pools. Estimated net reduction: 8–12 lines; fewer pools to reason about.
4. **reuse:** OTP's local cleanPhone/isValidE164 pair duplicates [normalizePhone](../../src/lib/phone.ts). Use the canonical parser and its established contract. Estimated net reduction: 8–12 lines; removes inconsistent phone acceptance.

**Estimated total: 70–110 net lines removed, 0 dependencies removed.** Estimates are advisory and were not implemented. The missing planned reports, campaign workflow and security checks are requirements, not speculative complexity to cut.

## Repair order

1. Restore honest verification: fix schema/API compile errors and the test setup/collection failures; replace placeholder/weakened tests with the exact planned assertions. Mark unsupported load/gate claims as unverified in a superseding record.
2. Fix money/session/loyalty locking and regeneration, OTP identity/atomic limits, consent transaction handling, and booking date/capacity correctness.
3. Repair notification contracts, cron authentication and production schedules. Prove order/bill/booking success remains independent of provider outages.
4. Complete the missing Phase 5/6 contracts: safe growth AI, canonical marketing/campaigns, dashboard/weekly facts, account UI/preflight, verified backup/restore and measured load harness.
5. Run all original phase gates in the fixed Node 22 environment, including Hindi/360 px/axe/JS budget, authorization and security checks. Only then update completion/handover and proceed to the human staging/pilot steps.
