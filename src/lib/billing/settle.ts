import { prisma } from "../db";
import { PaymentMethod } from "@prisma/client";
import { closeSession, lockSession } from "../sessions";
import { financialYear, formatInvoiceNumber } from "./fy";
import { audit } from "../audit";

export async function settleBill(
  billId: string,
  payments: Array<{ method: PaymentMethod; amountPaise: number }>,
  actor: { id: string },
  opts: { expectedTotalPaise: number; now?: Date; marketingConsent?: boolean }
) {
  return await prisma.$transaction(async (tx) => {
    // We must lock the session first to prevent concurrent orders/voids.
    const billMeta = await tx.bill.findUnique({
      where: { id: billId },
      select: { sessionId: true, session: { select: { kind: true, tableId: true } } }
    });

    if (!billMeta) {
      return { ok: false, error: "NOT_FOUND" } as const;
    }

    await lockSession(tx, { id: billMeta.sessionId, kind: billMeta.session.kind, tableId: billMeta.session.tableId });

    // Now lock the bill itself
    const res = await tx.$queryRaw<{ id: string; status: string; totalPaise: number; generatedAt: Date; customerPhone: string | null; customerName: string | null; phoneVerifiedAt: Date | null; loyaltyPointsRedeemed: number }[]>`
      SELECT id, status, "totalPaise", "generatedAt", "customerPhone", "customerName", "phoneVerifiedAt", "loyaltyPointsRedeemed" FROM "Bill" WHERE id = ${billId} FOR UPDATE
    `;

    if (res.length === 0) {
      return { ok: false, error: "NOT_FOUND" } as const;
    }

    const bill = res[0];

    if (bill.status === "SETTLED") {
      return { ok: false, error: "ALREADY_SETTLED" } as const;
    }

    if (bill.status === "CANCELLED") {
      return { ok: false, error: "BILL_CANCELLED" } as const;
    }

    if (bill.totalPaise !== opts.expectedTotalPaise) {
      return { ok: false, error: "STALE_BILL" } as const;
    }

    // Check for stale bill (orders placed after generation or lines voided after generation)
    const newOrders = await tx.order.count({
      where: {
        sessionId: billMeta.sessionId,
        status: { not: "REJECTED" },
        placedAt: { gt: bill.generatedAt }
      }
    });

    if (newOrders > 0) {
      return { ok: false, error: "STALE_BILL" } as const;
    }

    const voidedLines = await tx.orderLine.count({
      where: {
        order: { sessionId: billMeta.sessionId },
        voidedAt: { gt: bill.generatedAt }
      }
    });

    if (voidedLines > 0) {
      return { ok: false, error: "STALE_BILL" } as const;
    }

    // Validate payments
    let sum = 0;
    for (const p of payments) {
      if (!p.method || p.amountPaise <= 0 || !Number.isInteger(p.amountPaise)) {
        return { ok: false, error: "INVALID_PAYMENT" } as const;
      }
      sum += p.amountPaise;
    }

    if (sum !== bill.totalPaise) {
      return { ok: false, error: "PAYMENT_MISMATCH" } as const;
    }

    // Upsert customer and record consent BEFORE generating invoice number to respect lock order
    // "session advisory lock -> bill row -> customer row -> invoice counter"
    if (bill.customerPhone) {
      const { upsertCustomer } = await import("../customers");
      const { recordConsent } = await import("../customers/consent");
      const c = await upsertCustomer(bill.customerPhone, { name: bill.customerName }, tx);
      if (opts.marketingConsent) {
        await recordConsent(c.id, true, "BILLING", actor.id);
      }
      
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      if (settings?.loyaltyEnabled && bill.phoneVerifiedAt) {
        // Lock the customer row as per lock order
        const [lockedCustomer] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Customer" WHERE id = ${c.id} FOR UPDATE
        `;

        if (lockedCustomer) {
          const { getBalance, calculateEarnedPoints } = await import("../loyalty");
          const balance = await getBalance(c.id);

          if (bill.loyaltyPointsRedeemed > balance) {
            return { ok: false, error: "LOYALTY_BALANCE_CHANGED" } as const;
          }

          if (bill.loyaltyPointsRedeemed > 0) {
            await tx.loyaltyTxn.create({
              data: {
                customerId: c.id,
                kind: "REDEEM",
                points: -bill.loyaltyPointsRedeemed,
                billId: bill.id,
                actorId: actor.id
              }
            });
          }

          const earnedPoints = calculateEarnedPoints(bill.totalPaise, settings.loyaltyEarnPer100Rupees);
          if (earnedPoints > 0) {
            await tx.loyaltyTxn.create({
              data: {
                customerId: c.id,
                kind: "EARN",
                points: earnedPoints,
                billId: bill.id,
                actorId: actor.id
              }
            });
          }
        }
      }
    }

    const now = opts.now || new Date();
    const fy = financialYear(now);

    const counterRes = await tx.$queryRaw<{ last: number }[]>`
      INSERT INTO "InvoiceCounter" (fy, last) VALUES (${fy}, 1)
      ON CONFLICT (fy) DO UPDATE SET last = "InvoiceCounter".last + 1
      RETURNING last
    `;

    const last = counterRes[0].last;
    const number = formatInvoiceNumber(fy, last);

    await tx.payment.createMany({
      data: payments.map(p => ({
        billId,
        method: p.method,
        amountPaise: p.amountPaise,
        recordedById: actor.id,
        at: now
      }))
    });

    await tx.bill.update({
      where: { id: billId },
      data: {
        status: "SETTLED",
        number,
        settledAt: now,
        settledById: actor.id,
        marketingConsent: opts.marketingConsent
      }
    });

    await closeSession(tx, billMeta.sessionId);

    // Resolve open service requests
    await tx.serviceRequest.updateMany({
      where: { sessionId: billMeta.sessionId, resolvedAt: null },
      data: { resolvedAt: now, resolvedById: actor.id }
    });

    await audit({
      actorId: actor.id,
      action: "bill.settle",
      entity: "Bill",
      entityId: billId,
      data: { number, totalPaise: bill.totalPaise, payments }
    }, tx);

    return { ok: true, number } as const;
  }, { maxWait: 20000, timeout: 30000 });
}
