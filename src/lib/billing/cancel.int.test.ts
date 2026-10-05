import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db";
import { cancelBill } from "./cancel";
import { generateBill } from "./generate";
import { settleBill } from "./settle";
import { createStaffOrder } from "../orders/staff-order";
import { randomUUID } from "crypto";

describe("cancelBill", () => {
  let ownerId: string;
  let staffId: string;
  let tableId: string;
  let sessionId: string;
  let billId: string;
  let totalPaise: number;
  let invoiceNumber: string;

  beforeEach(async () => {
    await prisma.invoiceCounter.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.billLine.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.serviceRequest.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();
    await prisma.diningSession.deleteMany();
    await prisma.restaurantTable.deleteMany();
    await prisma.menuItem.deleteMany();

    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
    
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF" } });
    staffId = staff.id;

    const t = await prisma.restaurantTable.create({ data: { code: "T1", label: "T1" } });
    tableId = t.id;

    const m = await prisma.menuItem.create({
      data: {
        name: { en: "Test Item" },
        basePricePaise: 10000,
        available: true,
        isVeg: true,
        category: { create: { name: { en: "Cat" }, sortOrder: 0 } },
        sortOrder: 0
      }
    });

    const res = await createStaffOrder({
      target: { type: "TABLE", tableId },
      idempotencyKey: randomUUID(),
      items: [{ itemId: m.id, qty: 1, optionIds: [] }]
    }, staffId);
    if (!res.ok) throw new Error("Order failed");
    sessionId = res.sessionId;

    await prisma.order.updateMany({ where: { sessionId }, data: { status: "PREPARING", acceptedAt: new Date() } });

    const bRes = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error("Bill failed");
    billId = bRes.billId;

    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });
    totalPaise = bill.totalPaise;

    const sRes = await settleBill(billId, [{ method: "CASH", amountPaise: totalPaise }], { id: ownerId }, { expectedTotalPaise: totalPaise });
    if (!sRes.ok) throw new Error("Settle failed");
    invoiceNumber = sRes.number;
  }, 10000);

  it("Staff -> FORBIDDEN", async () => {
    const res = await cancelBill(billId, "Valid reason to cancel", { id: staffId, role: "STAFF" });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("owner on OPEN -> NOT_SETTLED", async () => {
    // create a new open bill
    const s = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o = await prisma.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 100 } });
    const bRes = await generateBill(s.id, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error("b failed");
    const openBillId = bRes.billId;

    const res = await cancelBill(openBillId, "Valid reason to cancel", { id: ownerId, role: "OWNER" });
    expect(res).toEqual({ ok: false, error: "NOT_SETTLED" });
  });

  it("owner on settled with short reason -> REASON_REQUIRED", async () => {
    const res = await cancelBill(billId, "bad", { id: ownerId, role: "OWNER" });
    expect(res).toEqual({ ok: false, error: "REASON_REQUIRED" });
  });

  it("success keeps number, payments, sets status, audit", async () => {
    const res = await cancelBill(billId, "Mistake in entry", { id: ownerId, role: "OWNER" });
    expect(res).toEqual({ ok: true });

    const b = await prisma.bill.findUniqueOrThrow({ where: { id: billId }, include: { payments: true } });
    expect(b.status).toBe("CANCELLED");
    expect(b.number).toBe(invoiceNumber);
    expect(b.payments).toHaveLength(1);
    expect(b.cancelledById).toBe(ownerId);
    expect(b.cancelReason).toBe("Mistake in entry");
    expect(b.cancelledAt).not.toBeNull();

    // Check table session remains CLOSED
    const s = await prisma.diningSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(s.status).toBe("CLOSED");

    // Check audit
    const audits = await prisma.auditLog.findMany({
      where: { entity: "Bill", entityId: billId, action: "bill.cancel" }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].data).toMatchObject({
      number: invoiceNumber,
      totalPaise,
      reason: "Mistake in entry"
    });
  });

  it("second cancel -> ALREADY_CANCELLED", async () => {
    await cancelBill(billId, "Mistake in entry", { id: ownerId, role: "OWNER" });
    const res2 = await cancelBill(billId, "Another reason", { id: ownerId, role: "OWNER" });
    expect(res2).toEqual({ ok: false, error: "ALREADY_CANCELLED" });
  });

  it("doesn't free invoice number", async () => {
    await cancelBill(billId, "Mistake in entry", { id: ownerId, role: "OWNER" });

    // New bill and settlement
    const s = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o = await prisma.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 100 } });
    
    const bRes = await generateBill(s.id, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error("b failed");
    
    const bill2 = await prisma.bill.findUniqueOrThrow({ where: { id: bRes.billId } });
    const sRes = await settleBill(bRes.billId, [{ method: "CASH", amountPaise: bill2.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill2.totalPaise });
    if (!sRes.ok) throw new Error("s failed");

    // New invoice number should be next in sequence
    const parts1 = invoiceNumber.split("/");
    const nextNum = (parseInt(parts1[1], 10) + 1).toString().padStart(4, "0");
    expect(sRes.number).toBe(`${parts1[0]}/${nextNum}`);
  });
});
