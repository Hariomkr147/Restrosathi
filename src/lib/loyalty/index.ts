/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from "../db";
import { audit } from "../audit";
import { LoyaltyKind, Prisma, type Bill } from "@prisma/client";
import { computeBillDraft } from "../billing/calc";

export function calculateEarnedPoints(totalPaise: number, earnPer100Rupees: number): number {
  return Math.floor(totalPaise / 10000) * earnPer100Rupees;
}

export function calculateRedemptionValue(points: number, unitPoints: number, unitValuePaise: number): number {
  if (!Number.isSafeInteger(points) || points <= 0 || !Number.isSafeInteger(unitPoints) || unitPoints <= 0 || points % unitPoints !== 0) {
    throw new Error("Points must be a multiple of the redemption unit");
  }
  return (points / unitPoints) * unitValuePaise;
}

export async function getBalance(customerId: string, tx?: Prisma.TransactionClient): Promise<number> {
  const client = tx || prisma;
  const result = await client.loyaltyTxn.aggregate({
    where: { customerId },
    _sum: { points: true }
  });
  return result._sum.points || 0;
}

export async function adjustPoints(
  customerId: string, 
  delta: number, 
  note: string, 
  actor: { id: string; role: string }
) {
  if (actor.role !== "OWNER") {
    throw new Error("UNAUTHORIZED");
  }
  if (delta === 0) {
    throw new Error("DELTA_ZERO");
  }
  if (!note || note.length < 3) {
    throw new Error("NOTE_REQUIRED");
  }

  const txn = await prisma.loyaltyTxn.create({
    data: {
      customerId,
      kind: LoyaltyKind.ADJUST,
      points: delta,
      note,
      actorId: actor.id
    }
  });

  await audit({
    actorId: actor.id,
    action: "loyalty.adjust",
    entity: "LoyaltyTxn",
    entityId: txn.id,
    data: { customerId, delta, note }
  });

  return txn;
}

export async function applyRedemption(billId: string, points: number, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const billMeta = await tx.bill.findUnique({
      where: { id: billId },
      select: { sessionId: true, session: { select: { kind: true, tableId: true } } }
    });
    if (!billMeta) throw new Error("NOT_FOUND");

    const { lockSession } = await import("../sessions");
    await lockSession(tx, { id: billMeta.sessionId, kind: billMeta.session.kind, tableId: billMeta.session.tableId });

    await tx.$queryRaw`SELECT id FROM "Bill" WHERE id = ${billId} FOR UPDATE`;
    const bill = await tx.bill.findUnique({ where: { id: billId } });
    
    if (!bill) throw new Error("NOT_FOUND");
    if (bill.status !== "OPEN") throw new Error("BILL_NOT_OPEN");
    if (!bill.customerPhone || !bill.phoneVerifiedAt) throw new Error("PHONE_NOT_VERIFIED");

    const settings = await tx.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.loyaltyEnabled) throw new Error("LOYALTY_DISABLED");

    await tx.$queryRaw`SELECT id FROM "Customer" WHERE phone = ${bill.customerPhone} FOR UPDATE`;
    const customer = await tx.customer.findUnique({ where: { phone: bill.customerPhone } });
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

    const balance = await getBalance(customer.id, tx);
    if (points > balance) throw new Error("INSUFFICIENT_BALANCE");

    const discountPaise = calculateRedemptionValue(points, settings.loyaltyRedeemUnitPoints, settings.loyaltyRedeemUnitValuePaise);
    
    await recomputeAndSaveBill(tx, bill, points, discountPaise);

    return true;
  });
}

async function recomputeAndSaveBill(tx: Prisma.TransactionClient, bill: Bill, points: number, discountPaise: number) {
  const lines = await tx.billLine.findMany({ where: { billId: bill.id } });
  const computed = computeBillDraft({
    lines: lines.map(l => ({ unitPricePaise: l.unitPricePaise, qty: l.qty })),
    discount: bill.discountType ? { type: bill.discountType, value: bill.discountValue ?? 0 } : null,
    taxMode: bill.taxMode,
    gstRatePercent: bill.gstRatePercent,
    pricesIncludeTax: bill.pricesIncludeTax,
    extraDiscountPaise: discountPaise
  });

  await tx.bill.update({
    where: { id: bill.id },
    data: {
      loyaltyPointsRedeemed: points,
      loyaltyDiscountPaise: discountPaise,
      subtotalPaise: computed.subtotalPaise,
      discountPaise: computed.discountPaise,
      taxableValuePaise: computed.taxableValuePaise,
      cgstPaise: computed.cgstPaise,
      sgstPaise: computed.sgstPaise,
      roundOffPaise: computed.roundOffPaise,
      totalPaise: computed.totalPaise
    }
  });
}

export async function removeRedemption(billId: string) {
  return prisma.$transaction(async (tx) => {
    const billMeta = await tx.bill.findUnique({
      where: { id: billId },
      select: { sessionId: true, session: { select: { kind: true, tableId: true } } }
    });
    if (!billMeta) return false;

    const { lockSession } = await import("../sessions");
    await lockSession(tx, { id: billMeta.sessionId, kind: billMeta.session.kind, tableId: billMeta.session.tableId });

    await tx.$queryRaw`SELECT id FROM "Bill" WHERE id = ${billId} FOR UPDATE`;
    const bill = await tx.bill.findUnique({ where: { id: billId } });
    
    if (!bill || bill.status !== "OPEN") return false;

    if (bill.customerPhone) {
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE phone = ${bill.customerPhone} FOR UPDATE`;
    }

    await recomputeAndSaveBill(tx, bill, 0, 0);

    return true;
  });
}
