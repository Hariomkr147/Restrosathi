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
    const bill = await tx.bill.findUnique({
      where: { id: billId }
    });

    if (!bill) return { ok: false, error: "NOT_FOUND" };
    if (bill.status === "CANCELLED") return { ok: false, error: "ALREADY_CANCELLED" };
    if (bill.status === "OPEN") return { ok: false, error: "NOT_SETTLED" };

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
