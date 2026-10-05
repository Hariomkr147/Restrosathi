import { prisma } from "../db";
import { PaymentMethod } from "@prisma/client";
import { closeSession, lockSession } from "../sessions";
import { financialYear, formatInvoiceNumber } from "./fy";
import { audit } from "../audit";

export async function settleBill(
  billId: string,
  payments: Array<{ method: PaymentMethod; amountPaise: number }>,
  actor: { id: string },
  opts: { expectedTotalPaise: number; now?: Date }
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
    const res = await tx.$queryRaw<{ id: string; status: string; totalPaise: number; generatedAt: Date }[]>`
      SELECT id, status, "totalPaise", "generatedAt" FROM "Bill" WHERE id = ${billId} FOR UPDATE
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
        settledById: actor.id
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
