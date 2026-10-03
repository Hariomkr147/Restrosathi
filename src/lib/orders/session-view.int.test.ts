import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { prisma } from "../db";
import { getSessionView } from "./session-view";
import { GET } from "../../app/api/t/[code]/status/route";

const tableIds = ["view-test-a", "view-test-b"], codes = ["VIEWTEST01", "VIEWTEST02"];
async function clean() {
  await prisma.orderLine.deleteMany({ where: { order: { session: { tableId: { in: tableIds } } } } });
  await prisma.order.deleteMany({ where: { session: { tableId: { in: tableIds } } } });
  await prisma.diningSession.deleteMany({ where: { tableId: { in: tableIds } } });
}
beforeAll(async () => { for (const [index, id] of tableIds.entries()) await prisma.restaurantTable.create({ data: { id, label: `View ${index}`, code: codes[index] } }); });
beforeEach(clean);
afterAll(async () => { await clean(); await prisma.restaurantTable.deleteMany({ where: { id: { in: tableIds } } }); });
async function session(tableId: string, name: string) {
  return prisma.diningSession.create({ data: { tableId, kind: "DINE_IN", orders: { create: { idempotencyKey: randomUUID(), source: "QR",
    lines: { create: [
      { nameSnapshot: { en: name, hi: "व्यंजन" }, modifiersSnapshot: [], qty: 2, unitPricePaise: 10000 },
      { nameSnapshot: { en: "Voided" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 5000, voidedAt: new Date() },
    ] } } } }, include: { orders: true } });
}
it("unknown and inactive codes reveal no data", async () => {
  expect(await getSessionView("MISSING123")).toBeNull();
  await prisma.restaurantTable.update({ where: { id: tableIds[0] }, data: { active: false } });
  expect(await getSessionView(codes[0])).toBeNull();
  await prisma.restaurantTable.update({ where: { id: tableIds[0] }, data: { active: true } });
});
it("table A never exposes table B, excluding rejected and voided lines from amount", async () => {
  const a = await session(tableIds[0], "A dish"); await session(tableIds[1], "Secret B dish");
  await prisma.order.create({ data: { sessionId: a.id, idempotencyKey: randomUUID(), source: "QR", status: "REJECTED", rejectReason: "Unavailable",
    lines: { create: { nameSnapshot: { en: "Rejected" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 9000 } } } });
  const view = await getSessionView(codes[0]);
  expect(view?.amountPaise).toBe(20000); expect(view?.orders).toHaveLength(2);
  expect(JSON.stringify(view)).not.toContain("Secret B dish");
  expect(view?.orders[0].lines).toEqual(expect.arrayContaining([expect.objectContaining({ voided: true })]));
});
it("closed history is hidden and an unused table has no session", async () => {
  const old = await session(tableIds[0], "Old dish");
  await prisma.diningSession.update({ where: { id: old.id }, data: { status: "CLOSED", closedAt: new Date() } });
  const view = await getSessionView(codes[0]);
  expect(view).toMatchObject({ session: null, orders: [], amountPaise: 0 });
  expect(await getSessionView(codes[1])).toMatchObject({ session: null, orders: [] });
});
it("public status route is no-store; unknown codes return404 without detail", async () => {
  const response = await GET(new Request(`http://localhost:3000/api/t/${codes[0]}/status`), { params: Promise.resolve({ code: codes[0] }) });
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  const absent = await GET(new Request("http://localhost:3000/api/t/absent/status"), { params: Promise.resolve({ code: "absent" }) });
  expect(absent.status).toBe(404); expect(await absent.text()).toBe("");
});
