import { expect, it, describe, beforeEach } from "vitest";
import { prisma } from "../db";
import { generateBill } from "./generate";
import { placeOrder } from "../orders/place";
import { acceptOrder, markReady, markServed, voidLine, rejectOrder } from "../orders/transitions";

const owner = { id: "test-owner", role: "OWNER" };
const staff = { id: "test-staff", role: "STAFF" };

describe("Generate Bill", () => {
  beforeEach(async () => {
    await prisma.bill.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();
    await prisma.diningSession.deleteMany();
    await prisma.restaurantTable.deleteMany();
  });

  async function updateTestSettings(data: any) {
    await prisma.settings.update({ where: { id: 1 }, data });
  }

  async function setup() {
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: "test-owner", name: "Owner", phone: "+911111111111", role: "OWNER" } });
    await prisma.user.create({ data: { id: "test-staff", name: "Staff", phone: "+912222222222", role: "STAFF" } });
    await prisma.menuItem.deleteMany();
    await prisma.category.deleteMany();
    const cat = await prisma.category.create({ data: { name: { en: "C" }, sortOrder: 1 } });
    await prisma.menuItem.create({ data: { id: "order-test-item", categoryId: cat.id, name: { en: "Item 1" }, basePricePaise: 12345, isVeg: true, sortOrder: 1 } });
    await prisma.menuItem.create({ data: { id: "order-test-other", categoryId: cat.id, name: { en: "Item 2" }, basePricePaise: 5000, isVeg: true, sortOrder: 2 } });
    await updateTestSettings({ taxMode: "NONE", gstRatePercent: 5, pricesIncludeTax: true, staffCanDiscount: true });
    const table = await prisma.restaurantTable.create({ data: { code: "1234567890", label: "Table B1", sortOrder: 1 } });
    const order1 = await placeOrder({ tableCode: "1234567890", idempotencyKey: "123e4567-e89b-12d3-a456-426614174001", items: [{ itemId: "order-test-item", qty: 2, optionIds: [] }, { itemId: "order-test-other", qty: 1, optionIds: [] }] }, { ip: "127.0.0.1", deviceId: "dev1" });
    const order2 = await placeOrder({ tableCode: "1234567890", idempotencyKey: "123e4567-e89b-12d3-a456-426614174002", items: [{ itemId: "order-test-item", qty: 1, optionIds: [] }] }, { ip: "127.0.0.1", deviceId: "dev1" });
    if (!order1.ok || !order2.ok) throw new Error(`Place order failed: ${JSON.stringify(order1)} ${JSON.stringify(order2)}`);
    const session = await prisma.diningSession.findFirstOrThrow({ where: { tableId: table.id } });
    return { session, order1: order1 as { ok: true, orderId: string }, order2: order2 as { ok: true, orderId: string } };
  }

  it("empty session -> EMPTY_BILL", async () => {
    const table = await prisma.restaurantTable.create({ data: { code: "E1", label: "E1", sortOrder: 1 } });
    const session = await prisma.diningSession.create({ data: { kind: "DINE_IN", tableId: table.id } });
    expect(await generateBill(session.id, {}, owner)).toEqual({ ok: false, error: "EMPTY_BILL" });
  });

  it("NEW order blocks generation with UNACCEPTED_ORDERS", async () => {
    const { session, order1 } = await setup();
    expect(await generateBill(session.id, {}, owner)).toEqual({ ok: false, error: "UNACCEPTED_ORDERS" });
    await acceptOrder(order1.orderId, owner.id);
    expect(await generateBill(session.id, {}, owner)).toEqual({ ok: false, error: "UNACCEPTED_ORDERS" });
  });

  it("rejected orders and voided lines are excluded, matches computeBill", async () => {
    const { session, order1, order2 } = await setup();
    await acceptOrder(order1.orderId, owner.id);
    
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: order1.orderId }, include: { lines: true } });
    await voidLine(o1.lines[1].id, "mistake", owner.id);
    
    await rejectOrder(order2.orderId, "No stock", owner.id);

    const result = await generateBill(session.id, {}, owner);
    expect(result).toMatchObject({ ok: true });

    const bill = await prisma.bill.findUniqueOrThrow({ where: { sessionId: session.id }, include: { lines: true } });
    expect(bill.subtotalPaise).toBe(12345 * 2);
    expect(bill.lines).toHaveLength(1);
    expect(bill.lines[0].qty).toBe(2);
    expect(bill.lines[0].linePaise).toBe(12345 * 2);
  });

  it("regenerating after another order/void updates totals and keeps one Bill row", async () => {
    const { session, order1, order2 } = await setup();
    await acceptOrder(order1.orderId, owner.id);
    await rejectOrder(order2.orderId, "No stock", owner.id);
    await generateBill(session.id, {}, owner);

    const bill1 = await prisma.bill.findUniqueOrThrow({ where: { sessionId: session.id } });
    expect(bill1.subtotalPaise).toBe(12345 * 2 + 5000);

    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: order1.orderId }, include: { lines: true } });
    await voidLine(o1.lines[1].id, "mistake", owner.id);

    await generateBill(session.id, {}, owner);
    const bill2 = await prisma.bill.findUniqueOrThrow({ where: { sessionId: session.id } });
    expect(bill2.id).toBe(bill1.id);
    expect(bill2.subtotalPaise).toBe(12345 * 2);
  });

  it("header snapshot equals Settings at generation, changing settings leaves bill untouched", async () => {
    const { session, order1, order2 } = await setup();
    await updateTestSettings({ name: "Test Restro" });
    await acceptOrder(order1.orderId, owner.id);
    await acceptOrder(order2.orderId, owner.id);

    await generateBill(session.id, {}, owner);
    const bill1 = await prisma.bill.findUniqueOrThrow({ where: { sessionId: session.id } });
    expect(bill1.taxMode).toBe("NONE");
    expect((bill1.header as any).name).toBe("Test Restro");

    await updateTestSettings({ taxMode: "REGULAR", name: "New Name" });

    const bill2 = await prisma.bill.findUniqueOrThrow({ where: { sessionId: session.id } });
    expect(bill2.taxMode).toBe("NONE");
    expect((bill2.header as any).name).toBe("Test Restro");
  });

  it("discount: STAFF without permission -> DISCOUNT_FORBIDDEN", async () => {
    const { session, order1, order2 } = await setup();
    await acceptOrder(order1.orderId, owner.id);
    await rejectOrder(order2.orderId, "No stock", owner.id);
    
    await updateTestSettings({ staffCanDiscount: false });
    expect(await generateBill(session.id, { discount: { type: "FLAT", value: 1000, reason: "friend" } }, staff)).toEqual({ ok: false, error: "DISCOUNT_FORBIDDEN" });
  });

  it("discount: STAFF with permission -> allowed, missing reason -> DISCOUNT_INVALID", async () => {
    const { session, order1, order2 } = await setup();
    await acceptOrder(order1.orderId, owner.id);
    await rejectOrder(order2.orderId, "No stock", owner.id);

    await updateTestSettings({ staffCanDiscount: true });
    expect(await generateBill(session.id, { discount: { type: "FLAT", value: 1000, reason: "" } }, staff)).toEqual({ ok: false, error: "DISCOUNT_INVALID" });
    const res = await generateBill(session.id, { discount: { type: "FLAT", value: 1000, reason: "friend" } }, staff);
    expect(res).toMatchObject({ ok: true });
    
    const bill = await prisma.bill.findUniqueOrThrow({ where: { sessionId: session.id } });
    expect(bill.discountPaise).toBe(1000);
  });

  it("closed session -> SESSION_CLOSED", async () => {
    const { session, order1, order2 } = await setup();
    await acceptOrder(order1.orderId, owner.id);
    await rejectOrder(order2.orderId, "No stock", owner.id);
    await prisma.diningSession.update({ where: { id: session.id }, data: { status: "CLOSED" } });
    expect(await generateBill(session.id, {}, owner)).toEqual({ ok: false, error: "SESSION_CLOSED" });
  });

  it("voidLine refused after settlement", async () => {
    const { session, order1, order2 } = await setup();
    await acceptOrder(order1.orderId, owner.id);
    await rejectOrder(order2.orderId, "No stock", owner.id);
    const res = await generateBill(session.id, {}, owner) as { ok: true, billId: string };
    
    await prisma.bill.update({ where: { id: res.billId }, data: { status: "SETTLED" } });
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: order1.orderId }, include: { lines: true } });
    expect(await voidLine(o1.lines[0].id, "mistake", owner.id)).toEqual({ ok: false, error: "BILL_LOCKED" });
  });
});
