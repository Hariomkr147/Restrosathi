import { prisma } from "../db";
import { audit } from "../audit";

export async function cancelBill(
  billId: string,
  reason: string,
  actor: { id: string; role: string }
): Promise<{ ok: true } | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" | "NOT_SETTLED" | "ALREADY_CANCELLED" | "REASON_REQUIRED" }> {
  if (actor.role !== "OWNER") {
    return { ok: false, error: "FORBIDDEN" };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5 || trimmedReason.length > 200) {
    return { ok: false, error: "REASON_REQUIRED" };
  }

  return prisma.$transaction(async (tx) => {
    const billMeta = await tx.bill.findUnique({
      where: { id: billId },
      select: { sessionId: true, session: { select: { kind: true, tableId: true } }, customerPhone: true }
    });
    if (!billMeta) return { ok: false, error: "NOT_FOUND" };

    const { lockSession } = await import("../sessions");
    await lockSession(tx, { id: billMeta.sessionId, kind: billMeta.session.kind, tableId: billMeta.session.tableId });

    const lockedBillRes = await tx.$queryRaw<{ id: string; status: string; number: string; totalPaise: number }[]>`
      SELECT id, status, number, "totalPaise" FROM "Bill" WHERE id = ${billId} FOR UPDATE
    `;
    if (lockedBillRes.length === 0) return { ok: false, error: "NOT_FOUND" };
    const bill = lockedBillRes[0];

    if (bill.status === "CANCELLED") return { ok: false, error: "ALREADY_CANCELLED" };
    if (bill.status === "OPEN") return { ok: false, error: "NOT_SETTLED" };

    if (billMeta.customerPhone) {
      const lockedCustomerRes = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Customer" WHERE phone = ${billMeta.customerPhone} FOR UPDATE
      `;
    }

    const now = new Date();

    await tx.bill.update({
      where: { id: billId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: actor.id,
        cancelReason: trimmedReason
      }
    });

    const txns = await tx.loyaltyTxn.findMany({
      where: { billId }
    });

    for (const txn of txns) {
      if (txn.kind === "EARN" || txn.kind === "REDEEM") {
        await tx.loyaltyTxn.create({
          data: {
            customerId: txn.customerId,
            kind: "REVERSE",
            points: -txn.points,
            billId: billId,
            reversesId: txn.id,
            actorId: actor.id,
            note: "Bill cancelled"
          }
        });
      }
    }

    await audit({
      actorId: actor.id,
      action: "bill.cancel",
      entity: "Bill",
      entityId: billId,
      data: {
        number: bill.number,
        totalPaise: bill.totalPaise,
        reason: trimmedReason
      }
    }, tx);

    return { ok: true };
  });
}
