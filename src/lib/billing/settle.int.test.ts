import { resetOperationalData } from "../../../tests/helpers/db";
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { settleBill } from "./settle";
import { prisma } from "../db";
import { generateBill } from "./generate";
import { createStaffOrder } from "../orders/staff-order";

describe("settleBill", () => {
  let tableId: string;
  let ownerId: string;
  let staffId: string;
  let sessionId: string;
  let billId: string;
  let totalPaise: number;
  let mItemId: string;

  beforeEach(async () => {
    await resetOperationalData();
    await prisma.menuItem.deleteMany({ where: { id: "test-item-settle" } });
    await prisma.category.deleteMany({ where: { id: "test-cat-settle" } });
    await prisma.restaurantTable.deleteMany({ where: { code: "T1_SETTLE" } });

    const t = await prisma.restaurantTable.create({ data: { code: "T1_SETTLE", label: "T1_SETTLE" } });
    tableId = t.id;

    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
    
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF" } });
    staffId = staff.id;

    const m = await prisma.menuItem.create({
      data: {
        id: "test-item-settle",
        name: { en: "Test Item" },
        basePricePaise: 10000,
        available: true,
        isVeg: true,
        category: { create: { id: "test-cat-settle", name: { en: "Cat" }, sortOrder: 0 } },
        sortOrder: 0
      }
    });
    mItemId = m.id;

    const res = await createStaffOrder({
      target: { type: "TABLE", tableId },
      idempotencyKey: randomUUID(),
      items: [{ itemId: m.id, qty: 1, optionIds: [] }]
    }, staffId);
    if (!res.ok) throw new Error("Order failed: " + JSON.stringify(res));
    
    sessionId = res.sessionId;
    await prisma.order.updateMany({ where: { sessionId }, data: { status: "PREPARING", acceptedAt: new Date() } });

    const bRes = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error("Bill failed");
    billId = bRes.billId;

    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });
    totalPaise = bill.totalPaise;
  }, 30000);

  it("single Cash payment equal to total -> SETTLED, number <FY>/0001, session CLOSED, service requests resolved", async () => {
    await prisma.serviceRequest.create({ data: { sessionId, kind: "REQUEST_BILL" } });
    
    const res = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: staffId }, { expectedTotalPaise: totalPaise });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.number).toMatch(/^\d{4}-\d{2}\/0001$/);

    const b = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });
    expect(b.status).toBe("SETTLED");
    expect(b.number).toBe(res.number);
    expect(b.settledById).toBe(staffId);

    const s = await prisma.diningSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(s.status).toBe("CLOSED");

    const reqs = await prisma.serviceRequest.findMany({ where: { sessionId } });
    expect(reqs[0].resolvedAt).not.toBeNull();
    
    const p = await prisma.payment.findMany({ where: { billId } });
    expect(p).toHaveLength(1);
    expect(p[0].method).toBe("CASH");
    expect(p[0].amountPaise).toBe(totalPaise);

    const audit = await prisma.auditLog.findFirst({ where: { action: "bill.settle", entityId: billId } });
    expect(audit).not.toBeNull();
  });

  it("split Cash + UPI works; sum one paisa short -> PAYMENT_MISMATCH and no number consumed", async () => {
    const res = await settleBill(billId, [
      { method: "CASH", amountPaise: totalPaise - 100 },
      { method: "UPI", amountPaise: 100 }
    ], { id: ownerId }, { expectedTotalPaise: totalPaise });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.number.endsWith("0001")).toBe(true);
    
    // Now try short sum
    const res2 = await createStaffOrder({ target: { type: "TAKEAWAY" }, idempotencyKey: randomUUID(), items: [{ itemId: mItemId, qty: 1, optionIds: [] }] }, staffId);
    if (!res2.ok) throw new Error("O2 fail");
    await prisma.order.updateMany({ where: { sessionId: res2.sessionId }, data: { status: "PREPARING", acceptedAt: new Date() } });
    const b2 = await generateBill(res2.sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!b2.ok) throw new Error("B2 fail");

    const bill2 = await prisma.bill.findUniqueOrThrow({ where: { id: b2.billId } });
    const short = await settleBill(b2.billId, [{ method: "CARD", amountPaise: bill2.totalPaise - 1 }], { id: ownerId }, { expectedTotalPaise: bill2.totalPaise });
    expect(short.ok).toBe(false);
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((short as any).error).toBe("PAYMENT_MISMATCH");

    // The next successful settlement gets 0002, not 0003!
    const ok2 = await settleBill(b2.billId, [{ method: "CARD", amountPaise: bill2.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill2.totalPaise });
    expect(ok2.ok).toBe(true);
    if (!ok2.ok) return;
    expect(ok2.number.endsWith("0002")).toBe(true);
  });

  it("zero/negative/non-integer -> INVALID_PAYMENT", async () => {
    expect((await settleBill(billId, [{ method: "CASH", amountPaise: 0 }], { id: ownerId }, { expectedTotalPaise: totalPaise })).ok).toBe(false);
    expect((await settleBill(billId, [{ method: "CASH", amountPaise: -100 }], { id: ownerId }, { expectedTotalPaise: totalPaise })).ok).toBe(false);
    expect((await settleBill(billId, [{ method: "CASH", amountPaise: 100.5 }], { id: ownerId }, { expectedTotalPaise: totalPaise })).ok).toBe(false);
  });

  it("settling twice -> ALREADY_SETTLED, cancelled -> BILL_CANCELLED", async () => {
    await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    const r2 = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    expect(r2.ok).toBe(false);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r2 as any).error).toBe("ALREADY_SETTLED");

    await prisma.bill.update({ where: { id: billId }, data: { status: "CANCELLED" } });
    const r3 = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    expect(r3.ok).toBe(false);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r3 as any).error).toBe("BILL_CANCELLED");
  });

  it("stale checks", async () => {
    const st1 = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise - 100 });
    expect(st1.ok).toBe(false);
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((st1 as any).error).toBe("STALE_BILL");

    // Add new order
    await createStaffOrder({ target: { type: "TABLE", tableId }, idempotencyKey: randomUUID(), items: [{ itemId: mItemId, qty: 1, optionIds: [] }] }, staffId);
    const st2 = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    expect(st2.ok).toBe(false);
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((st2 as any).error).toBe("STALE_BILL");

    // Recalculate bill
    const b3 = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!b3.ok) throw new Error("B3 fail");
    const bill3 = await prisma.bill.findUniqueOrThrow({ where: { id: b3.billId } });
    const st3 = await settleBill(b3.billId, [{ method: "CASH", amountPaise: bill3.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill3.totalPaise });
    expect(st3.ok).toBe(true);
  });

  it("two concurrent settlements -> one ok, one ALREADY_SETTLED", async () => {
    const p1 = settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    const p2 = settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    
    const [r1, r2] = await Promise.all([p1, p2]);
    const oks = [r1, r2].filter(r => r.ok);
    const errs = [r1, r2].filter(r => !r.ok);
    
    expect(oks).toHaveLength(1);
    expect(errs).toHaveLength(1);
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((errs[0] as any).error).toBe("ALREADY_SETTLED");
    
    const count = await prisma.invoiceCounter.findFirst();
    expect(count?.last).toBe(1);
  });

  describe("20 concurrent settlements", () => {
    const runConcurrent = async () => {
      await prisma.invoiceCounter.deleteMany();
      await prisma.payment.deleteMany();
      await prisma.billLine.deleteMany();
      await prisma.bill.deleteMany();
      await prisma.orderLine.deleteMany();
      await prisma.order.deleteMany();
      await prisma.diningSession.deleteMany();

      const promises = [];
      for (let i = 0; i < 20; i++) {
        const p = (async () => {
          const s = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
          const o = await prisma.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
          await prisma.orderLine.create({ data: { orderId: o.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 1000 } });
          const b = await generateBill(s.id, {}, { id: ownerId, role: "OWNER" });
          if (!b.ok) throw new Error("B fail");
          const bill = await prisma.bill.findUniqueOrThrow({ where: { id: b.billId } });
          
          return settleBill(b.billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise });
        })();
        promises.push(p);
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.ok)).toBe(true);

                                             // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numbers = results.map(r => (r as any).number.split("/")[1]).sort();
      for (let i = 0; i < 20; i++) {
        expect(numbers[i]).toBe((i + 1).toString().padStart(4, "0"));
      }
    };

    it("run 1", runConcurrent, 30000);
    it("run 2", runConcurrent, 30000);
    it("run 3", runConcurrent, 30000);
  });

  it("number resets per financial year", async () => {
    // 2026-04-01 is 2026-27
    const r1 = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise, now: new Date("2026-04-01T10:00:00Z") });
    expect(r1.ok).toBe(true);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r1 as any).number).toBe("2026-27/0001");

    const s2 = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o2 = await prisma.order.create({ data: { sessionId: s2.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o2.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 1000 } });
    const b2 = await generateBill(s2.id, {}, { id: ownerId, role: "OWNER" });
    if (!b2.ok) throw new Error("B fail");
    const bill2 = await prisma.bill.findUniqueOrThrow({ where: { id: b2.billId } });

    const r2 = await settleBill(b2.billId, [{ method: "CASH", amountPaise: bill2.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill2.totalPaise, now: new Date("2027-03-31T18:29:59Z") });
    expect(r2.ok).toBe(true);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r2 as any).number).toBe("2026-27/0002");

    const s3 = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o3 = await prisma.order.create({ data: { sessionId: s3.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o3.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 1000 } });
    const b3 = await generateBill(s3.id, {}, { id: ownerId, role: "OWNER" });
    if (!b3.ok) throw new Error("B fail");
    const bill3 = await prisma.bill.findUniqueOrThrow({ where: { id: b3.billId } });

    const r3 = await settleBill(b3.billId, [{ method: "CASH", amountPaise: bill3.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill3.totalPaise, now: new Date("2027-03-31T18:30:00Z") });
    expect(r3.ok).toBe(true);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r3 as any).number).toBe("2027-28/0001");
  });

  it("concurrent 100-point redemptions with balance 100 yield one settlement and one balance-changed failure with no invoice consumed", async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { loyaltyEnabled: true, loyaltyEarnPer100Rupees: 10, loyaltyRedeemUnitPoints: 100, loyaltyRedeemUnitValuePaise: 10000 } });
    const { upsertCustomer } = await import("../customers");
    const c = await upsertCustomer("9999911111", { verified: true });
    await prisma.loyaltyTxn.create({ data: { customerId: c.id, kind: "EARN", points: 100 } });

    // Setup 2 sessions
    const s1 = await prisma.diningSession.create({ data: { kind: "TAKEAWAY", customerPhone: c.phone } });
    const o1 = await prisma.order.create({ data: { sessionId: s1.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o1.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 20000 } }); // 200 rs
    const b1Res = await generateBill(s1.id, {}, { id: ownerId, role: "OWNER" });
    if (!b1Res.ok) throw new Error("b1 gen failed");
    const b1 = await prisma.bill.findUniqueOrThrow({ where: { id: b1Res.billId } });
    
    const s2 = await prisma.diningSession.create({ data: { kind: "TAKEAWAY", customerPhone: c.phone } });
    const o2 = await prisma.order.create({ data: { sessionId: s2.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o2.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 20000 } });
    const b2Res = await generateBill(s2.id, {}, { id: ownerId, role: "OWNER" });
    if (!b2Res.ok) throw new Error("b2 gen failed");
    const b2 = await prisma.bill.findUniqueOrThrow({ where: { id: b2Res.billId } });

    // Apply loyalty discount to both drafts
    const { applyRedemption } = await import("../loyalty");
    await prisma.bill.update({ where: { id: b1.id }, data: { phoneVerifiedAt: new Date() } });
    await prisma.bill.update({ where: { id: b2.id }, data: { phoneVerifiedAt: new Date() } });
    await applyRedemption(b1.id, 100, ownerId);
    await applyRedemption(b2.id, 100, ownerId);

    const b1Fresh = await prisma.bill.findUniqueOrThrow({ where: { id: b1.id } });
    const b2Fresh = await prisma.bill.findUniqueOrThrow({ where: { id: b2.id } });

    const p1 = settleBill(b1.id, [{ method: "CASH", amountPaise: b1Fresh.totalPaise }], { id: ownerId }, { expectedTotalPaise: b1Fresh.totalPaise });
    const p2 = settleBill(b2.id, [{ method: "CASH", amountPaise: b2Fresh.totalPaise }], { id: ownerId }, { expectedTotalPaise: b2Fresh.totalPaise });

    const [r1, r2] = await Promise.all([p1, p2]);
    const oks = [r1, r2].filter(r => r.ok);
    const errs = [r1, r2].filter(r => !r.ok);
    if (oks.length !== 1) console.log("ERRORS:", errs);

    expect(oks).toHaveLength(1);
    expect(errs).toHaveLength(1);
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((errs[0] as any).error).toBe("LOYALTY_BALANCE_CHANGED");

    const invoices = await prisma.invoiceCounter.findFirst();
    expect(invoices?.last).toBe(1); // Should only consume 1 invoice number
  });
});
