# Phase 3 Security and Money Review

This document audits the critical financial, concurrent, and authorization guarantees implemented in Phase 3 (Billing).

## 1. Client-Sent Totals Ignored
Client pricing is never trusted. The `generateBill` function recomputes the bill exactly from the un-voided, un-rejected order lines stored in the database. `settleBill` accepts an `expectedTotalPaise` for concurrent safety, but the actual total to be settled is retrieved from the database `Bill` snapshot and verified against the expected value. At no point does the system rely on client-supplied order totals or line amounts to generate the invoice.

## 2. Settlement Transaction and Locking
Settlement uses an explicitly ordered transaction with an advisory lock: `SELECT pg_advisory_xact_lock(hashtextextended('table:' || ${tableId}, 0))` via `lockSession` or `lockTable` helpers. This ensures multiple simultaneous settlement attempts queue correctly. Inside the transaction, the invoice number is securely generated via a dedicated `InvoiceCounter` sequence row using an atomic increment. Deadlocks are avoided by acquiring the table/session lock first, before the invoice counter.

## 3. Invoice Numbering Under Failure
Because the invoice sequence is fetched inside the settlement transaction, if any part of the settlement process fails (such as an expected amount mismatch or payment parsing error), the transaction rolls back, and the invoice number is not consumed. The `increment_invoice` raw query guarantees atomic fetching with `UPDATE ... RETURNING`.

## 4. Snapshot Immutability After Settings Change
The `Bill` and `BillLine` tables persist the tax mode, GST rate, restaurant name, and GSTIN at the moment of bill generation. If the owner subsequently modifies the restaurant's global tax settings or name, previously generated bills remain intact. Tax recalculations apply only to newly generated bills or when explicitly regenerating an open bill.

## 5. Cancel and Discount Permissions
- **Cancel**: `cancelBill` enforces `requireUser("OWNER")`. Staff members cannot cancel settled bills. Tested explicitly in `authz-matrix.int.test.ts`.
- **Discount**: Discounts are validated in `generateBill`. A non-owner user attempting to apply a discount must have `staffCanDiscount` enabled in Settings. Otherwise, a `DISCOUNT_FORBIDDEN` error is returned. A required reason string is also strictly checked.

## 6. Audit Rows for Every Money Action
Every billing action is fully audited:
- Bill generation produces an `ORDER_STATE` or `BILL_GENERATED` style audit (Phase 2 audit tracks state; generation updates session state).
- Settlement creates an audit row explicitly noting the payment methods and amounts.
- Cancellation inserts a cancellation audit log including the reason and the actor ID.

## 7. No Float Arithmetic
A codebase search (`grep src/lib/billing` for `Math.`) confirms the absence of risky float arithmetic (`parseFloat`, `toFixed`, or arbitrary `Math` functions) outside of safe integer logic. Prices and totals are all stored as integer paise. Rounding of halved GST amounts (CGST/SGST) correctly uses integer division combined with `Math.floor()`, combined with Bankers Rounding logic in `money.ts`.

## 8. No Customer Access to Another Table's Bill
The `getSessionView(code)` query explicitly enforces customer bounds. It looks up the table by the active 10-character URL code, retrieves its current non-closed dining session, and fetches the `Bill` joined precisely on that session ID. Therefore, a client cannot query or expose the bill of any other table. The endpoint exposes no raw database IDs for either table or session.
