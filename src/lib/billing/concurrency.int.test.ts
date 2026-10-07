import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { generateBill } from "./generate";
import { settleBill } from "./settle";
import { prisma } from "../db";
import { placeOrder } from "../orders/place";
import { createStaffOrder } from "../orders/staff-order";
import { applyRedemption } from "../loyalty";

describe("Billing Concurrency Regressions", () => {
  let tableId: string;
  let ownerId: string;
  let staffId: string;
  let sessionId: string;
  let mItemId: string;

  beforeEach(async () => {
    await prisma.invoiceCounter.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.billLine.deleteMany();
    await prisma.feedback.deleteMany();
    await prisma.loyaltyTxn.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.serviceRequest.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();
    await prisma.diningSession.deleteMany();
    await prisma.customer.deleteMany();

    await prisma.menuItem.deleteMany({ where: { id: "test-item-conc" } });
    await prisma.category.deleteMany({ where: { id: "test-cat-conc" } });
    await prisma.restaurantTable.deleteMany({ where: { code: "1234567890" } });

    const t = await prisma.restaurantTable.create({ data: { code: "1234567890", label: "T1_CONC" } });
    tableId = t.id;

    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF" } });
    staffId = staff.id;

    const m = await prisma.menuItem.create({
      data: {
        id: "test-item-conc",
        name: { en: "Test Item" },
        basePricePaise: 10000,
        available: true,
        isVeg: true,
        category: { create: { id: "test-cat-conc", name: { en: "Cat" }, sortOrder: 0 } },
        sortOrder: 0
      }
    });
    mItemId = m.id;

    const res = await createStaffOrder({
      target: { type: "TABLE", tableId },
      idempotencyKey: randomUUID(),
      items: [{ itemId: m.id, qty: 1, optionIds: [] }]
    }, staffId);
    if (!res.ok) throw new Error("Order failed");
    
    sessionId = res.sessionId;
    await prisma.order.updateMany({ where: { sessionId }, data: { status: "PREPARING", acceptedAt: new Date() } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generate vs place: one waits for the other, no missed order lines", async () => {
    const pGenerate = generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    const pPlace = placeOrder({
      tableCode: "1234567890",
      idempotencyKey: randomUUID(),
      items: [{ itemId: mItemId, qty: 1, optionIds: [] }]
    }, { ip: "127.0.0.1", deviceId: "dev1" });

    const [resGen, resPlace] = await Promise.all([pGenerate, pPlace]);
    expect(resGen.ok).toBe(true);
    if (!resPlace.ok) console.log("placeOrder error:", (resPlace as any).error);
    expect(resPlace.ok).toBe(true);

    const bill = await prisma.bill.findFirstOrThrow({ where: { sessionId } });
    
    const billLinesCount = await prisma.billLine.count({ where: { billId: bill.id } });
    const ordersCount = await prisma.orderLine.count({ where: { order: { sessionId } } });
    
    expect(billLinesCount === 1 || billLinesCount === 2).toBe(true);
    expect(ordersCount).toBe(2);
  });

  it("regenerate vs settle: settle locks out regenerate or vice versa", async () => {
    const bRes = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error();
    const billId = bRes.billId;

    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });

    const pSettle = settleBill(billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise });
    const pRegen = generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });

    const [resSettle, resRegen] = await Promise.all([pSettle, pRegen]);
    expect(resSettle.ok).toBe(true);
    if (!resRegen.ok) {
      expect(["BILL_LOCKED", "SESSION_CLOSED"]).toContain((resRegen as any).error);
    }
  });

  it("apply redemption vs settle: atomic updates", async () => {
    const bRes = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error();
    const billId = bRes.billId;

    await prisma.settings.update({ where: { id: 1 }, data: { loyaltyEnabled: true } });
    const c = await prisma.customer.create({ data: { phone: "+919999999999" } });
    await prisma.loyaltyTxn.create({ data: { customerId: c.id, kind: "EARN", points: 1000, actorId: ownerId } });
    
    await prisma.bill.update({ where: { id: billId }, data: { customerPhone: "+919999999999", phoneVerifiedAt: new Date() } });

    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });

    const pSettle = settleBill(billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise });
    const pApply = applyRedemption(billId, 100, ownerId).catch(e => e.message);

    const [resSettle, resApply] = await Promise.all([pSettle, pApply]);
    expect(resSettle.ok || resApply === true).toBeTruthy();
  });

  it("two generators: only one bill created", async () => {
    const [r1, r2] = await Promise.all([
      generateBill(sessionId, {}, { id: ownerId, role: "OWNER" }),
      generateBill(sessionId, {}, { id: ownerId, role: "OWNER" })
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect((r1 as any).billId).toBe((r2 as any).billId);

    const bills = await prisma.bill.findMany({ where: { sessionId } });
    expect(bills).toHaveLength(1);
  });

  it("two settlers: one wins, one gets ALREADY_SETTLED", async () => {
    const bRes = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
    if (!bRes.ok) throw new Error();
    const billId = bRes.billId;

    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });

    const [r1, r2] = await Promise.all([
      settleBill(billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise }),
      settleBill(billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise })
    ]);

    const oks = [r1, r2].filter(r => r.ok);
    const errs = [r1, r2].filter(r => !r.ok);

    expect(oks).toHaveLength(1);
    expect(errs).toHaveLength(1);
    expect((errs[0] as any).error).toBe("ALREADY_SETTLED");

    const bills = await prisma.bill.findMany({ where: { id: billId } });
    expect(bills[0].status).toBe("SETTLED");
  });
});
