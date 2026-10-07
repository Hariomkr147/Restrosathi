/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from "../db";
import { audit } from "../audit";
import { LoyaltyKind } from "@prisma/client";

export function calculateEarnedPoints(totalPaise: number, earnPer100Rupees: number): number {
  return Math.floor(totalPaise / 10000) * earnPer100Rupees;
}

export function calculateRedemptionValue(points: number, unitPoints: number, unitValuePaise: number): number {
  if (points <= 0 || points % unitPoints !== 0) {
    throw new Error("Points must be a multiple of the redemption unit");
  }
  return (points / unitPoints) * unitValuePaise;
}

export async function getBalance(customerId: string): Promise<number> {
  const result = await prisma.loyaltyTxn.aggregate({
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
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) throw new Error("NOT_FOUND");
  if (bill.status !== "OPEN") throw new Error("BILL_NOT_OPEN");
  if (!bill.customerPhone || !bill.phoneVerifiedAt) throw new Error("PHONE_NOT_VERIFIED");

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings || !settings.loyaltyEnabled) throw new Error("LOYALTY_DISABLED");

  const customer = await prisma.customer.findUnique({ where: { phone: bill.customerPhone } });
  if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

  const balance = await getBalance(customer.id);
  if (points > balance) throw new Error("INSUFFICIENT_BALANCE");

  const discountPaise = calculateRedemptionValue(points, settings.loyaltyRedeemUnitPoints, settings.loyaltyRedeemUnitValuePaise);
  
  // Recompute bill
  const lines = await prisma.billLine.findMany({ where: { billId } });
  
  const { computeBill } = await import("../billing/calc");
  let draftDiscount = null;
  if (bill.discountType) {
    draftDiscount = {
      type: bill.discountType,
      valuePaise: bill.discountType === "FLAT" ? (bill.discountValue || 0) : 0,
      percent: bill.discountType === "PERCENT" ? (bill.discountValue || 0) : 0,
    };
  }

  const computed = computeBill({
    lines: lines.map(l => ({ unitPricePaise: l.unitPricePaise, qty: l.qty })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discount: draftDiscount as any,
    taxMode: bill.taxMode,
    gstRatePercent: bill.gstRatePercent,
    pricesIncludeTax: bill.pricesIncludeTax,
    extraDiscountPaise: discountPaise
  });

  await prisma.bill.update({
    where: { id: billId },
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

  return true;
}

export async function removeRedemption(billId: string) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill || bill.status !== "OPEN") return false;

  const lines = await prisma.billLine.findMany({ where: { billId } });
  
  const { computeBill } = await import("../billing/calc");
  let draftDiscount = null;
  if (bill.discountType) {
    draftDiscount = {
      type: bill.discountType,
      valuePaise: bill.discountType === "FLAT" ? (bill.discountValue || 0) : 0,
      percent: bill.discountType === "PERCENT" ? (bill.discountValue || 0) : 0,
    };
  }

  const computed = computeBill({
    lines: lines.map(l => ({ unitPricePaise: l.unitPricePaise, qty: l.qty })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discount: draftDiscount as any,
    taxMode: bill.taxMode,
    gstRatePercent: bill.gstRatePercent,
    pricesIncludeTax: bill.pricesIncludeTax,
    extraDiscountPaise: 0
  });

  await prisma.bill.update({
    where: { id: billId },
    data: {
      loyaltyPointsRedeemed: 0,
      loyaltyDiscountPaise: 0,
      subtotalPaise: computed.subtotalPaise,
      discountPaise: computed.discountPaise,
      taxableValuePaise: computed.taxableValuePaise,
      cgstPaise: computed.cgstPaise,
      sgstPaise: computed.sgstPaise,
      roundOffPaise: computed.roundOffPaise,
      totalPaise: computed.totalPaise
    }
  });

  return true;
}
