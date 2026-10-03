import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { prisma } from "../db";
import { createServiceRequest } from "./service-requests";

const tableId = "service-test-table", code = "SERVICET01", ctx = { deviceId: "service-test-device", ip: "service-test-ip" };
async function clean() {
  await prisma.serviceRequest.deleteMany({ where: { session: { tableId } } });
  await prisma.diningSession.deleteMany({ where: { tableId } });
  await prisma.rateHit.deleteMany({ where: { key: { startsWith: "service:" } } });
}
beforeAll(async () => { await prisma.restaurantTable.create({ data: { id: tableId, label: "Service test", code } }); });
beforeEach(clean);
afterAll(async () => { await clean(); await prisma.restaurantTable.delete({ where: { id: tableId } }); });
it("one open waiter request is idempotent, including concurrent calls", async () => {
  expect(await createServiceRequest(code, "CALL_WAITER", ctx)).toEqual({ ok: true, already: false });
  const results = await Promise.all(Array.from({ length: 5 }, () => createServiceRequest(code, "CALL_WAITER", ctx)));
  expect(results).toEqual(Array(5).fill({ ok: true, already: true }));
  expect(await prisma.serviceRequest.count({ where: { session: { tableId }, kind: "CALL_WAITER", resolvedAt: null } })).toBe(1);
});
it("requesting the bill marks the current session without closing it", async () => {
  expect(await createServiceRequest(code, "REQUEST_BILL", ctx)).toEqual({ ok: true, already: false });
  expect(await prisma.diningSession.findFirstOrThrow({ where: { tableId } })).toMatchObject({ status: "BILL_REQUESTED" });
});
it("unknown table or invalid request is refused", async () => {
  expect(await createServiceRequest("MISSING123", "CALL_WAITER", ctx)).toMatchObject({ ok: false, error: "TABLE_NOT_FOUND" });
  expect(await createServiceRequest(code, "BAD_KIND", ctx)).toMatchObject({ ok: false, error: "INVALID_INPUT" });
});
it("device cap10/hour applies separately per kind, and duplicates consume no extra hit", async () => {
  for (let index = 0; index < 10; index++) {
    expect(await createServiceRequest(code, "CALL_WAITER", ctx)).toEqual({ ok: true, already: false });
    expect(await createServiceRequest(code, "CALL_WAITER", ctx)).toEqual({ ok: true, already: true });
    await prisma.serviceRequest.updateMany({ where: { session: { tableId }, kind: "CALL_WAITER", resolvedAt: null }, data: { resolvedAt: new Date() } });
  }
  expect(await createServiceRequest(code, "CALL_WAITER", ctx)).toEqual({ ok: false, error: "RATE_LIMITED" });
  expect(await createServiceRequest(code, "REQUEST_BILL", ctx)).toEqual({ ok: true, already: false });
});
