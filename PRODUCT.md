# RestroSathi: Product

*Durable product truth. Visual rules go in `DESIGN.md`, token values in `src/brand/theme.css`. Scope and acceptance criteria are in `docs/superpowers/`.*

## What it is
A website, QR table-ordering, kitchen and billing system for one restaurant at a time. Sold by Hariom Kumar to restaurants in India that **use no software today** (paper bills, no POS). This repo is the prototype for one fictional demo restaurant, **Saffron Tadka**. Multi-restaurant support is a later phase.

## Who uses it
- **Customers:** scan a QR code at the table on a phone (often low-end Android, 4G), browse the menu, order, call the waiter, ask for the bill. Many read Hindi first.
- **Staff:** accept orders, run the kitchen board, enter walk-in and takeaway orders, bill and settle. Shared tablet, busy, hands full.
- **Owner:** edits the menu and settings, sees reports, handles bookings, later customers and growth tools.

## What it is not
- No online payment in this version. The customer sees the bill amount only; staff record Cash, UPI or Card.
- No official WhatsApp API; WA-AKG is used for the prototype only. Marketing messages are sent from the owner's own phone via `wa.me` links.
- Not a multi-restaurant platform yet. No delivery ordering, inventory or aggregator integrations.

## Facts that must not be invented
Restaurant name, address, hours, phone, GSTIN, FSSAI number, dishes, prices, awards, reviews, statistics, customer testimonials. Demo data is clearly fictional. Never fake proof of customers or claims.

## Constraints (summary; the spec is authoritative)
- Money in integer paise, shown as ₹ with Indian grouping. Times shown in Asia/Kolkata.
- English and Hindi everywhere; Hindi falls back to English, never blank.
- WCAG 2.2 AA, 44 px touch targets, no horizontal scroll at 360 px, `/menu` ≤ 150 KB JS.
- Staff screens favour clarity and speed over decoration. Customer-facing pages can be warm and expressive.

## Voice
Warm, plain and direct. Short sentences. No hype and no filler. Hindi copy is natural Hindi, not transliterated English. Prices and facts are exact.
