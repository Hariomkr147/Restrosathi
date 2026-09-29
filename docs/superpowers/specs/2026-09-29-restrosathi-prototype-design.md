# RestroSathi Prototype — Design Spec

- **Date:** 2026-09-29
- **Author:** Hariom Kumar (with Claude)
- **Status:** Draft, awaiting review

---

## 1. Context and goals

**What:** A branded, mobile-first website + in-restaurant ordering system that Hariom builds and sells to individual restaurants (India) to help them grow.

**This spec covers:** a working **prototype for one restaurant**, used to demo and sell to restaurant owners.

**Success looks like:**
- A restaurant owner can see their own branded site, a customer can scan a table QR and order, staff see the order live, and the owner sees customers, bookings and sales.
- A new restaurant copy can be rebranded by editing one tokens file + logo/photos + seed data.

**Business model:** custom site per restaurant (setup fee + monthly maintenance). Not a self-serve SaaS for now.

### Decisions made during brainstorming

| Topic | Decision | Why |
|---|---|---|
| Codebase model | One `restrosathi-template` repo; each restaurant is a **git fork/copy** of it | Prototype stage; fixes flow to copies with `git pull` from the template remote |
| Stack | **Next.js (App Router, TypeScript) full-stack** + Tailwind CSS + shadcn/ui + Motion; PostgreSQL via Prisma | One app to run/deploy/copy; strongest visual/UX tooling |
| Python / FastAPI | **Not used now.** Added later only for custom ML (demand forecasting) | All v1 AI features are hosted-model API calls, callable from TypeScript |
| i18n | **next-intl** for UI strings (`messages/en.json`, `messages/hi.json`); DB content stored as `{ en, hi }` JSON | Hindi + English from day one; more languages = new key, no migration |
| WhatsApp | **WA-AKG** (self-hosted, MIT, Baileys-based) for the prototype, on a **spare SIM, never a client's main number**. All sends go through one function `sendWhatsApp()` | Unofficial = ban risk; the single function makes the switch to Meta's official Cloud API a one-file change |
| Bulk marketing | **One-tap-per-customer** sends only, no bulk blasts on WA-AKG | Bulk sends are the main ban trigger |
| Payments | **UPI intent link / QR** (`upi://pay?...&am=...`) to the restaurant's own UPI ID; staff tap "Paid". No payment gateway | Zero fees, no KYC wait; gateway (e.g. Razorpay) later |
| Live updates | Staff screen **polls every 3 s** with a sound on new orders | Simplest reliable option for one restaurant; SSE later if needed |
| AI provider | Anthropic Claude (Haiku-class model) via the official TypeScript SDK, wrapped in `lib/ai.ts` | Cheap/fast; provider is swappable inside one file |
| Demo brand | Fictional **"Saffron Tadka"** restaurant, unless a real client provides their brand with permission | Demo must not use a real restaurant's name/logo without permission |

### Out of scope (this version)

Online delivery/takeaway ordering, payment gateway, menu-from-photo AI, AI translate button, demand forecasting (Python), n8n, Reserve with Google, Zomato/Swiggy integration, multi-outlet, inventory, gift vouchers.

---

## 2. Build stages

1. **Stage 1: Sell-able demo.** Branded public site, menu, QR table ordering, staff live order board + tables, menu editor, AI menu assistant (#3), auth, brand tokens, i18n.
2. **Stage 2: Bookings.** Table booking, event packages + enquiries, WA-AKG integration, WhatsApp confirmations/reminders, WhatsApp AI auto-reply (#4).
3. **Stage 3: Growth.** Customers (CRM), loyalty, UPI bill payment, feedback + Google review link, owner dashboard, AI feedback summary (#5), AI weekly owner report (#6), AI marketing drafts (#7).

Each stage ends deployable and demo-able. **Implementation plans are written one stage at a time, starting with Stage 1.**

---

## 3. Architecture

```
                 ┌──────────────── VPS (Docker Compose) ────────────────┐
 Customer phone ─┤  Caddy (HTTPS) ──► Next.js app ──► PostgreSQL        │
 Staff tablet   ─┤                        │  ▲                           │
 Owner phone    ─┤                        │  │ webhook (secret header)   │
                 │                        ▼  │                           │
                 │                     WA-AKG ──► WhatsApp (spare SIM)   │
                 │   cron ──► POST /api/cron/* (reminders, weekly report)│
                 └───────────────────────────────────────────────────────┘
                                   │
                                   └──► Anthropic API (lib/ai.ts)
```

**One Next.js app, three surfaces:**
- **Public site:** `/`, `/menu`, `/book`, `/events`, `/feedback/[token]`
- **Table ordering:** `/t/[tableCode]`
- **Staff/owner:** `/admin/*` (login required)

**Key modules (one clear job each):**
- `lib/whatsapp.ts`: `sendWhatsApp(phone, text)` + webhook parsing. Only file that knows WA-AKG exists.
- `lib/ai.ts`: `menuAssistant()`, `autoReply()`, `summarizeFeedback()`, `weeklyReport()`, `draftCampaign()`. Enforces the monthly usage cap. Only file that knows the AI provider.
- `lib/billing.ts`: bill totals, GST, loyalty earn/redeem. Pure functions, unit-tested.
- `lib/upi.ts`: builds the `upi://pay` link and QR payload.
- `brand/tokens.ts` + `brand/assets/*`: the only files changed to rebrand a copy (plus `prisma/seed.ts` for menu data).

**Hosting:** one small VPS; Docker Compose services: `app`, `postgres`, `wa-akg`, `caddy`. System cron calls authenticated `/api/cron/*` routes. Nightly `pg_dump` backup, kept 7 days.

---

## 4. Brand and visual system

- Semantic design tokens (colour, typography, spacing, radius, shadow, motion) in `brand/tokens.ts`, exposed as CSS variables and mapped into the Tailwind theme. Components use tokens only, never raw hex values.
- Spacing on a consistent 4px scale; type scale on a consistent ratio; no one-off exceptions.
- Motion: subtle page transitions, add-to-cart feedback, bottom-sheet cart. Durations from tokens (`fast` 150ms, `base` 250ms). All motion disabled under `prefers-reduced-motion`.
- **Accessibility target: WCAG 2.2 AA.** Must: visible focus on every interactive element; text contrast ≥ 4.5:1 (≥ 3:1 large text); every action has a descriptive label; all flows usable by keyboard and touch (targets ≥ 44px).
- Every interactive component must define default, hover, focus-visible, active, disabled, loading and error states.
- Mobile-first; tested at 360px width on a low-end Android over 4G.

---

## 5. Customer experience

### Public site (Hindi/English toggle on every page)
- **Home:** hero food image, story, signature dishes, primary CTAs *Book a table / View menu / Plan an event*, hours, Google Maps embed, Google reviews link, floating Call + WhatsApp buttons.
- **Menu:** sticky category tabs, search, veg/non-veg filter, spice level, Bestseller / Chef's special tags, photos. View-only on the website.
- **Book a table:** date, time slot, party size, name, phone, occasion (+ birthday/anniversary date), notes, offers-consent checkbox → creates a *requested* booking.
- **Events:** package cards (price per plate), enquiry form (type, date, guests, package, phone).
- **SEO:** page metadata + Restaurant JSON-LD (name, address, hours, menu URL).

### QR table ordering (`/t/[tableCode]`)
1. Scan → menu opens showing table label; no login, no app.
2. Add to cart (bottom sheet), per-item note, "goes well with" suggestions from item pairings.
3. First order asks name + phone (+ offers consent) once; remembered on the device.
4. Place order → status *Received → Preparing → Served*. Further rounds join the same **TableSession** bill.
5. Always-visible **Call waiter** and **Request bill** buttons.
6. Bill view: itemised lines, GST, total, loyalty points available, **Pay by UPI** button (opens UPI app with amount) + QR fallback, or "pay at counter".

**Abuse protection:** table codes are random 8+ character strings; staff must **accept** each new order; rate limit on orders per session.

### AI menu assistant (#3)
- "Ask what to order" button on menu + table pages. Understands Hindi, English, Hinglish.
- Model receives only the current *available* menu (ids, names, prices, tags). It returns structured output: reply text + list of item ids. Unknown ids are dropped. Shown as tappable "Add" chips; **prices always rendered from DB**.
- Only answers about this restaurant/menu. Allergy questions → "please confirm with staff".
- Rate-limited per device; hidden gracefully when the cap is reached or the AI errors.

---

## 6. Staff and owner screens

**Roles:** `STAFF` (orders, tables, bookings, events), `OWNER` (everything). Auth.js credentials login, hashed passwords, httpOnly session cookie.

### Staff
- **Live orders board:** columns *New → Preparing → Ready → Served*; sound + highlight on new order; **Accept / Reject**. Waiter-call and bill-request alerts pinned on top with table label. Kitchen view = same board filtered, for a kitchen tablet/TV.
- **Kitchen ticket (KOT):** browser print with 80mm print CSS.
- **Tables:** grid with status (free / occupied / bill requested / paid); open bill, apply loyalty points, mark **Paid (UPI / Cash)**, close session. Printable QR sheet for all tables.
- **Bookings:** today + pending; **Confirm / Decline** (sends WhatsApp); mark *Arrived / No-show*.
- **Events:** enquiry status *New → Quoted → Deposit paid → Confirmed / Lost*; send UPI deposit link on WhatsApp.

### Owner
- **Menu editor:** categories; items with `{en, hi}` name/description, price, veg, spice, tags, photo upload, pairings, **Sold out today** toggle.
- **Customers:** auto-built from phones on orders/bookings; visits, total spent, last visit, birthday/anniversary, points, opt-out; WhatsApp button.
- **Loyalty:** configurable earn rate (default 1 point per ₹100) and redeem rate (default 100 points = ₹50).
- **Feedback (#5):** after payment, guest receives a feedback link (1–5 stars + comment); **everyone** also sees the Google review link (no rating-based gating). AI weekly theme summary + AI-drafted review replies for owner approval.
- **Marketing (#7):** AI drafts festival / birthday / win-back messages; owner edits; sent **one tap per customer**; opted-out customers excluded.
- **WhatsApp auto-reply (#4) log:** conversations handled by AI; `needsHuman` items highlighted.
- **Dashboard (#6):** today's sales, orders, average bill, top dishes, busy hours, upcoming bookings. Every Monday 09:00 IST, AI weekly report sent to the owner's WhatsApp.
- **Settings:** hours, tables, booking slots + capacity per slot, UPI ID + payee name, GST %, loyalty rates, AI monthly cap, WhatsApp connection status.

### WhatsApp flows
| Trigger | Message | Type |
|---|---|---|
| Booking confirmed/declined | Confirmation with date, time, party size | Transactional (auto) |
| 3 hours before booking | Reminder | Transactional (cron) |
| Event deposit | UPI deposit link | Transactional (staff tap) |
| Bill paid | Thank-you + feedback link | Transactional (auto) |
| Incoming customer message | AI auto-reply (hours, location, menu, booking help) or "staff will reply shortly" + `needsHuman` | Reply (auto) |
| Customer replies STOP | Set `optOut`, confirm | Auto |
| Campaigns | Owner-approved drafts | Marketing (one tap each) |
| Monday 09:00 | Weekly report to owner | Internal (cron) |

---

## 7. Data model (Prisma)

All money is stored as **integer paise**. All times stored in UTC, displayed in Asia/Kolkata.

- **Settings** (single row): name, hours JSON, upiId, upiPayeeName, gstPercent, loyaltyEarnPer100, loyaltyRedeemPoints, loyaltyRedeemValuePaise, slotConfig JSON, aiMonthlyCap, ownerPhone.
- **User:** id, name, phone, passwordHash, role (`OWNER` | `STAFF`).
- **Category:** id, name `{en,hi}`, sortOrder.
- **MenuItem:** id, categoryId, name `{en,hi}`, description `{en,hi}`, pricePaise, isVeg, spiceLevel (0–3), tags[], photoUrl, available, sortOrder.
- **MenuPairing:** itemId, pairedItemId.
- **Table:** id, label, code (unique, random).
- **TableSession:** id, tableId, customerId?, status (`OPEN` | `BILL_REQUESTED` | `PAID`), paymentMethod (`UPI` | `CASH`)?, pointsRedeemed, openedAt, closedAt?.
- **Order:** id, sessionId, idempotencyKey (unique), status (`NEW` | `ACCEPTED` | `PREPARING` | `READY` | `SERVED` | `REJECTED`), createdAt.
- **OrderItem:** id, orderId, menuItemId, qty, unitPricePaise (snapshot), note.
- **ServiceRequest:** id, sessionId, type (`WAITER` | `BILL`), createdAt, resolvedAt?.
- **Customer:** id, phone (unique, E.164), name, birthday?, anniversary?, points, marketingConsent, optOut, createdAt.
- **Booking:** id, customerId, startsAt, partySize, occasion?, notes?, status (`REQUESTED` | `CONFIRMED` | `DECLINED` | `ARRIVED` | `NO_SHOW`), reminderSentAt?.
- **EventPackage:** id, name `{en,hi}`, description `{en,hi}`, pricePerPlatePaise, minGuests.
- **EventEnquiry:** id, customerId, packageId?, eventType, date, guests, notes?, status (`NEW` | `QUOTED` | `DEPOSIT_PAID` | `CONFIRMED` | `LOST`), depositPaise?.
- **Feedback:** id, sessionId, token (unique), rating?, comment?, submittedAt?.
- **MessageLog:** id, direction (`IN` | `OUT`), phone, text, kind, status (`SENT` | `FAILED` | `RECEIVED`), aiHandled, needsHuman, createdAt.
- **AiUsage:** month (`YYYY-MM`), calls. Checked before every AI call.

**Derived, not stored:** customer visits and total spent (from paid sessions); bill totals (from order items).

---

## 8. Error handling

| Situation | Behaviour |
|---|---|
| WhatsApp disconnected / send fails | Core action (booking, order, payment) still succeeds; message logged `FAILED`; owner sees "WhatsApp disconnected — scan again" banner |
| AI error, timeout (10 s) or cap reached | Menu assistant shows "Not available right now — please browse the menu"; auto-reply sends fallback text and sets `needsHuman` |
| AI returns unknown item ids | Dropped silently; only real menu items shown |
| Customer network drops | Cart persisted on device; order POST carries `idempotencyKey` so retries never duplicate |
| Item sold out between cart and order | Server rejects that line with a clear message; rest of order can proceed after confirmation |
| Booking over slot capacity | Checked on request and again on confirm; customer offered nearby slots |
| Invalid input | Zod validation on every server action/route; field-level errors shown |
| Unauthorised access | Every `/admin` route and action checks session + role |
| WA-AKG webhook | Rejected unless the shared secret header matches |
| Secrets | WA-AKG API key and AI key server-side only (env vars) |
| Abuse | Rate limits on order placement per session and AI chats per device/IP |

**Privacy:** phone capture shows a consent line + offers checkbox (India DPDP Act); STOP opt-out honoured; customer data never shared across restaurant copies.

**Known limitation:** some UPI apps restrict amount-prefilled links to personal (non-merchant) UPI IDs. The restaurant should use a business/merchant UPI ID; the QR fallback covers remaining cases.

---

## 9. Testing

- **Unit (Vitest):** `lib/billing.ts` (totals, GST, rounding, loyalty earn/redeem), booking capacity check, order status transition rules, `lib/upi.ts` link builder.
- **End-to-end (Playwright),** with `sendWhatsApp` and `lib/ai.ts` replaced by fakes:
  1. Scan QR → order → staff accept → served → request bill → mark paid → feedback link logged.
  2. Book table → staff confirm → confirmation message logged.
  3. Owner marks dish sold out → it disappears from menu and cannot be ordered.
- **Manual QA:** low-end Android over 4G at 360px; keyboard-only pass; focus visible everywhere; contrast check; Hindi layout check (longer strings, no overflow).

---

## 10. QA checklist (before each demo)

- [ ] Brand tokens only; no raw hex in components
- [ ] Hindi and English complete; no missing-key fallbacks visible
- [ ] Every button has hover, focus-visible, active, disabled, loading and error states
- [ ] Reduced-motion respected
- [ ] QR codes printed and scan correctly from 50 cm
- [ ] WhatsApp connected on the spare SIM (not a client number)
- [ ] AI cap set; assistant fallback works with AI disabled
- [ ] Nightly backup ran in the last 24 h
- [ ] All three Playwright flows pass
