import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { asAnonymous, cookieJar } from "../../../tests/helpers/auth";
import { placeOrderAction } from "../../app/t/[code]/actions";
import { prisma } from "../db";
import { closeSession, markBillRequested } from "../sessions";
import { placeOrder } from "./place";

const tableId = "order-test-table", itemId = "order-test-item", tableCode = "ORDERTEST1";
const ctx = { deviceId: "order-test-device", ip: "order-test-ip" };
const actionDeviceIds: string[] = [];
const line = { itemId, variantId: "order-test-variant", optionIds: ["order-test-option"], qty: 2, note: "Less salt" };
const input = () => ({ tableCode, idempotencyKey: randomUUID(), customerName: "Guest", items: [line] });
async function clean() {
  const sessions = await prisma.diningSession.findMany({ where: { tableId }, select: { id: true } });
  await prisma.orderLine.deleteMany({ where: { order: { session: { tableId } } } });
  await prisma.order.deleteMany({ where: { session: { tableId } } });
  await prisma.rateHit.deleteMany({ where: { OR: [
    { key: { startsWith: "device:order-test-" } }, { key: { startsWith: "ip:order-test-" } },
    { key: { in: actionDeviceIds.map((id) => `device:${id}`) } }, { key: "ip:127.0.0.1" },
    { key: { in: sessions.map(({ id }) => `session:${id}`) } },
  ] } });
  await prisma.diningSession.deleteMany({ where: { tableId } });
}
beforeAll(async () => {
  await prisma.restaurantTable.create({ data: { id: tableId, label: "Order test", code: tableCode } });
  await prisma.menuItem.create({ data: {
    id: itemId, categoryId: "starters", name: { en: "Test dish", hi: "परीक्षण व्यंजन" }, isVeg: true,
    variants: { create: { id: "order-test-variant", name: { en: "Full", hi: "पूरा" }, pricePaise: 25000 } },
    modifierGroups: { create: { id: "order-test-group", name: { en: "Extra", hi: "अतिरिक्त" }, min: 1, max: 1,
      options: { create: [
        { id: "order-test-option", name: { en: "Cheese", hi: "चीज़" }, priceDeltaPaise: 3000 },
        { id: "order-test-other-option", name: { en: "Butter", hi: "मक्खन" }, priceDeltaPaise: 1000 },
      ] } } },
  } });
});
beforeEach(async () => {
  await clean(); await prisma.restaurantTable.update({ where: { id: tableId }, data: { active: true } });
  await prisma.menuItem.update({ where: { id: itemId }, data: { available: true } });
  await prisma.menuVariant.update({ where: { id: "order-test-variant" }, data: { pricePaise: 25000 } });
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => { await clean(); await prisma.menuItem.delete({ where: { id: itemId } }); await prisma.restaurantTable.delete({ where: { id: tableId } }); });
it("snapshots bilingual names and computes variant plus options instead of client price", async () => {
  const result = await placeOrder({ ...input(), items: [{ ...line, unitPricePaise: 1 }] }, ctx);
  expect(result).toMatchObject({ ok: true, duplicate: false });
  if (!result.ok) throw new Error(result.error);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { lines: true } });
  expect(order).toMatchObject({ source: "QR", status: "NEW", customerName: "Guest" });
  expect(order.lines[0]).toMatchObject({ qty: 2, unitPricePaise: 28000, note: "Less salt",
    nameSnapshot: { en: "Test dish", hi: "परीक्षण व्यंजन" }, variantSnapshot: { en: "Full", hi: "पूरा" },
    modifiersSnapshot: [{ en: "Cheese", hi: "चीज़" }] });
});
it("sold-out or missing items create no order", async () => {
  await prisma.menuItem.update({ where: { id: itemId }, data: { available: false } });
  expect(await placeOrder(input(), ctx)).toEqual({ ok: false, error: "ITEM_UNAVAILABLE", itemId });
  expect(await placeOrder({ ...input(), items: [{ ...line, itemId: "absent" }] }, ctx)).toEqual({ ok: false, error: "ITEM_UNAVAILABLE", itemId: "absent" });
  expect(await prisma.order.count({ where: { session: { tableId } } })).toBe(0);
});
it.each([
  { variantId: "absent" }, { variantId: undefined }, { optionIds: ["absent"] },
  { optionIds: [] }, { optionIds: ["order-test-option", "order-test-other-option"] },
])("invalid choice %j creates no order", async (choice) => {
  expect(await placeOrder({ ...input(), items: [{ ...line, ...choice }] }, ctx)).toEqual({ ok: false, error: "CHOICE_INVALID", itemId });
  expect(await prisma.order.count({ where: { session: { tableId } } })).toBe(0);
});
it("unknown and inactive tables fail", async () => {
  expect(await placeOrder({ ...input(), tableCode: "MISSING123" }, ctx)).toEqual({ ok: false, error: "TABLE_NOT_FOUND" });
  await prisma.restaurantTable.update({ where: { id: tableId }, data: { active: false } });
  expect(await placeOrder(input(), ctx)).toEqual({ ok: false, error: "TABLE_NOT_FOUND" });
});
it("duplicate submits return the original id without consuming another rate hit", async () => {
  const payload = input(); const first = await placeOrder(payload, ctx);
  expect(first.ok).toBe(true);
  expect(await placeOrder(payload, ctx)).toEqual({ ...first, duplicate: true });
  expect(await prisma.order.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(1);
  expect(await prisma.rateHit.count({ where: { key: `device:${ctx.deviceId}` } })).toBe(1);
});
it("five concurrent duplicate submits produce one order and one charged hit", async () => {
  for (let loop = 0; loop < 3; loop++) {
    await clean(); const payload = input();
    const results = await Promise.all(Array.from({ length: 5 }, () => placeOrder(payload, ctx)));
    expect(results.every((result) => result.ok)).toBe(true);
    expect(new Set(results.map((result) => result.ok && result.orderId)).size).toBe(1);
    expect(results.filter((result) => result.ok && !result.duplicate)).toHaveLength(1);
    expect(await prisma.order.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(1);
    expect(await prisma.rateHit.count({ where: { key: `device:${ctx.deviceId}` } })).toBe(1);
  }
});
it("distinct keys share the same active session", async () => {
  const results = await Promise.all([placeOrder(input(), ctx), placeOrder(input(), ctx)]);
  expect(results.every((result) => result.ok)).toBe(true);
  const orders = await prisma.order.findMany({ where: { session: { tableId } } });
  expect(orders).toHaveLength(2); expect(new Set(orders.map(({ sessionId }) => sessionId)).size).toBe(1);
});
it("device cap rejects order 21 even with different IPs", async () => {
  for (let index = 0; index < 20; index++) expect(await placeOrder(input(), { ...ctx, ip: `order-test-ip-${index}` })).toMatchObject({ ok: true });
  expect(await placeOrder(input(), { ...ctx, ip: "order-test-fresh-ip" })).toEqual({ ok: false, error: "RATE_LIMITED" });
  expect(await prisma.order.count({ where: { session: { tableId } } })).toBe(20);
}, 15000);
it("session and loose IP caps apply independently of device", async () => {
  const first = await placeOrder(input(), ctx); expect(first.ok).toBe(true);
  const session = await prisma.diningSession.findFirstOrThrow({ where: { tableId } });
  await prisma.rateHit.createMany({ data: Array.from({ length: 29 }, () => ({ key: `session:${session.id}` })) });
  expect(await placeOrder(input(), { ...ctx, deviceId: "order-test-other-device" })).toEqual({ ok: false, error: "RATE_LIMITED" });
  await prisma.rateHit.createMany({ data: Array.from({ length: 59 }, () => ({ key: `ip:${ctx.ip}` })) });
  expect(await placeOrder(input(), { ...ctx, deviceId: "order-test-fresh-device" })).toEqual({ ok: false, error: "RATE_LIMITED" });
});
it("bill-requested stays active; after close a fresh session receives the new order", async () => {
  expect(await placeOrder(input(), ctx)).toMatchObject({ ok: true });
  const session = await prisma.diningSession.findFirstOrThrow({ where: { tableId } });
  await prisma.$transaction((tx) => markBillRequested(tx, session.id));
  expect(await placeOrder(input(), ctx)).toMatchObject({ ok: true });
  expect(await prisma.diningSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ status: "BILL_REQUESTED" });
  await prisma.$transaction((tx) => closeSession(tx, session.id));
  const result = await placeOrder(input(), ctx); expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  expect(await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } })).not.toMatchObject({ sessionId: session.id });
  expect(await prisma.order.count({ where: { sessionId: session.id } })).toBe(2);
});
it("invalid input is a typed failure before persistence", async () => {
  expect(await placeOrder({}, ctx)).toEqual({ ok: false, error: "INVALID_INPUT" });
});
it("anonymous callers can place through the public action with a server-owned device id", async () => {
  asAnonymous();
  const result = await placeOrderAction(input());
  const device = cookieJar.get("rs_device")?.value;
  if (device) actionDeviceIds.push(device);
  expect(result).toMatchObject({ ok: true });
  expect(device).toMatch(/^[a-f0-9]{32}$/);
  expect(await prisma.rateHit.count({ where: { key: `device:${device}` } })).toBe(1);
  expect(await prisma.rateHit.count({ where: { key: "ip:127.0.0.1" } })).toBe(1);
});
it("the configurable IP cap remains independent of device", async () => {
  vi.stubEnv("RATE_LIMIT_IP_ORDERS_PER_HOUR", "2");
  for (let index = 0; index < 2; index++) expect(await placeOrder(input(), { ...ctx, deviceId: `order-test-device-${index}` })).toMatchObject({ ok: true });
  expect(await placeOrder(input(), { ...ctx, deviceId: "order-test-device-fresh" })).toEqual({ ok: false, error: "RATE_LIMITED" });
});
it("computed prices outside the database integer range fail without a partial order", async () => {
  await prisma.menuVariant.update({ where: { id: "order-test-variant" }, data: { pricePaise: 2147483647 } });
  expect(await placeOrder(input(), ctx)).toEqual({ ok: false, error: "CHOICE_INVALID", itemId });
  expect(await prisma.order.count({ where: { session: { tableId } } })).toBe(0);
});
