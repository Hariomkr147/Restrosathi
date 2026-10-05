import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../db";
import { getDayEnd, dayWindowIst } from "./day-end";
import { generateBill } from "./generate";
import { settleBill } from "./settle";
import { cancelBill } from "./cancel";
import { createStaffOrder } from "../orders/staff-order";
import { randomUUID } from "crypto";

describe("getDayEnd", () => {
  let ownerId: string;
  let staffId: string;
  
  beforeEach(async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF" } });
    staffId = staff.id;
  });

  it("aggregates data correctly and respects window", async () => {
    // Set fixed date for test: "2026-10-05"
    const testDate = "2026-10-05";
    const window = dayWindowIst(testDate);
    const midDayIst = new Date(window.from.getTime() + 12 * 60 * 60_000); // 12 PM IST
    const lateNightIst = new Date(window.from.getTime() + 23 * 60 * 60_000 + 59 * 60_000); // 23:59 IST
    const nextDayIst = window.to; // 00:00 next day IST
    
    const t = await prisma.restaurantTable.findFirstOrThrow();
    const m = await prisma.menuItem.findFirstOrThrow();
    
    // Create 3 bills in the window
    async function makeSettledBill(time: Date, paymentMethod: "CASH" | "UPI" | "CARD") {
      vi.setSystemTime(time);
      const s = await prisma.diningSession.create({ data: { kind: "DINE_IN", tableId: t.id } });
      const o = await prisma.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING", acceptedAt: time } });
      await prisma.orderLine.create({ data: { orderId: o.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 100 } });
      const bRes = await generateBill(s.id, {}, { id: ownerId, role: "OWNER" });
      if (!bRes.ok) throw new Error();
      const bill = await prisma.bill.findUniqueOrThrow({ where: { id: bRes.billId } });
      await settleBill(bRes.billId, [{ method: paymentMethod, amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise, now: time });
      return bill;
    }

    const b1 = await makeSettledBill(midDayIst, "CASH");
    const b2 = await makeSettledBill(lateNightIst, "UPI");
    const b3 = await makeSettledBill(nextDayIst, "CARD"); // Should be OUTSIDE window!

    // One split payment in window
    vi.setSystemTime(midDayIst);
    const sSplit = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const oSplit = await prisma.order.create({ data: { sessionId: sSplit.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING", acceptedAt: midDayIst } });
    await prisma.orderLine.create({ data: { orderId: oSplit.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 2, unitPricePaise: 100 } });
    const bSplit = await generateBill(sSplit.id, {}, { id: ownerId, role: "OWNER" });
    if (!bSplit.ok) throw new Error();
    const billSplit = await prisma.bill.findUniqueOrThrow({ where: { id: bSplit.billId } });
    await settleBill(bSplit.billId, [{ method: "UPI", amountPaise: 100 }, { method: "CASH", amountPaise: billSplit.totalPaise - 100 }], { id: ownerId }, { expectedTotalPaise: billSplit.totalPaise, now: midDayIst });

    // Cancelled bill in window
    vi.setSystemTime(midDayIst);
    const bCancel = await makeSettledBill(midDayIst, "CASH");
    await cancelBill(bCancel.id, "Cancel", { id: ownerId, role: "OWNER" });

    // Voided line in window
    const oVoid = await prisma.order.create({ data: { sessionId: sSplit.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING", acceptedAt: midDayIst } });
    await prisma.orderLine.create({ data: { orderId: oVoid.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 2, unitPricePaise: 50, voidedAt: midDayIst } });

    vi.useRealTimers();

    const report = await getDayEnd(testDate, { id: ownerId, role: "OWNER" });
    
    // Aggregates for 3 valid settled bills (b1, b2, split)
    // b1: 100 total
    // b2: 100 total
    // split: 200 total
    // cancel is not in settled bills list because status="CANCELLED"
    expect(report.billCount).toBe(3);
    
    // b1 (CASH 100) + b2 (UPI 100) + split (UPI 100, CASH 100)
    // b3 is out of window
    expect(report.byMethod.CASH).toBe(200);
    expect(report.byMethod.UPI).toBe(200);
    expect(report.byMethod.CARD).toBe(0);
    
    expect(report.cancelled.count).toBe(1);
    expect(report.cancelled.totalPaise).toBe(100);

    expect(report.voidedLines.count).toBe(1);
    expect(report.voidedLines.valuePaise).toBe(100);

    expect(report.reconciles).toBe(true);

    // Corrupt one payment to test reconciles
    await prisma.payment.updateMany({
      where: { billId: b1.id },
      data: { amountPaise: 999 }
    });

    const reportBad = await getDayEnd(testDate, { id: ownerId, role: "OWNER" });
    expect(reportBad.reconciles).toBe(false);

    // STAFF rejected
    await expect(getDayEnd(testDate, { id: staffId, role: "STAFF" })).rejects.toThrow("FORBIDDEN");
  });
});
