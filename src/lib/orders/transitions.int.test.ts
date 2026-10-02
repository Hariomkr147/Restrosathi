import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { asAnonymous, asStaff } from "../../../tests/helpers/auth";
import { destroySession } from "../auth/session";
import { prisma } from "../db";
import * as actions from "../../app/admin/orders/actions";
import { acceptOrder, rejectOrder, markReady, markServed, voidLine } from "./transitions";

const sessionId = "transition-test-session", actorId = "staff-ravi";
async function clean() {
  const orders = await prisma.order.findMany({ where: { sessionId }, select: { id: true } });
  const ids = orders.map(({ id }) => id);
  const lines = await prisma.orderLine.findMany({ where: { orderId: { in: ids } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...lines.map(({ id }) => id)] } } });
  await prisma.orderLine.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { sessionId } });
}
async function order(status: OrderStatus = "NEW") {
  return prisma.order.create({ data: { sessionId, idempotencyKey: randomUUID(), source: "QR", status,
    lines: { create: { nameSnapshot: { en: "Test dish", hi: "परीक्षण व्यंजन" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 10000 } } }, include: { lines: true } });
}
beforeAll(async () => { await prisma.diningSession.create({ data: { id: sessionId, kind: "TAKEAWAY" } }); });
beforeEach(clean);
afterEach(async () => { await destroySession(); asAnonymous(); });
afterAll(async () => { await clean(); await prisma.diningSession.delete({ where: { id: sessionId } }); });

const steps = [
  { from: "NEW", to: "PREPARING", field: "acceptedAt", action: "order.accept", run: (id: string) => acceptOrder(id, actorId) },
  { from: "NEW", to: "REJECTED", field: "rejectedAt", action: "order.reject", run: (id: string) => rejectOrder(id, "Kitchen closed", actorId) },
  { from: "PREPARING", to: "READY", field: "readyAt", action: "order.ready", run: (id: string) => markReady(id, actorId) },
  { from: "READY", to: "SERVED", field: "servedAt", action: "order.serve", run: (id: string) => markServed(id, actorId) },
] as const;
it.each(steps)("$from → $to timestamps and audits atomically", async (step) => {
  const before = await order(step.from);
  expect(await step.run(before.id)).toEqual({ ok: true });
  const after = await prisma.order.findUniqueOrThrow({ where: { id: before.id } });
  expect(after.status).toBe(step.to); expect(after[step.field]).toBeInstanceOf(Date);
  if (step.to === "REJECTED") expect(after.rejectReason).toBe("Kitchen closed");
  expect(await prisma.auditLog.findMany({ where: { entityId: before.id } })).toMatchObject([{ actorId, action: step.action }]);
});
const states: OrderStatus[] = ["NEW", "PREPARING", "READY", "SERVED", "REJECTED"];
it.each(steps.flatMap((step) => states.filter((from) => from !== step.from).map((from) => ({ ...step, from }))))("refuses $from → $to without changing data or audit", async (step) => {
  const before = await order(step.from);
  expect(await step.run(before.id)).toEqual({ ok: false, error: "INVALID_TRANSITION" });
  expect(await prisma.order.findUniqueOrThrow({ where: { id: before.id }, include: { lines: true } })).toEqual(before);
  expect(await prisma.auditLog.count({ where: { entityId: before.id } })).toBe(0);
});
it.each(["", "  ", "ab", "x".repeat(201)])("reject needs a bounded reason: %s", async (reason) => {
  const before = await order();
  expect(await rejectOrder(before.id, reason, actorId)).toEqual({ ok: false, error: "REASON_REQUIRED" });
  expect(await prisma.order.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({ status: "NEW", rejectedAt: null });
});
it("two concurrent accepts have one winner and one audit", async () => {
  for (let loop = 0; loop < 3; loop++) {
    const before = await order();
    const results = await Promise.all([acceptOrder(before.id, actorId), acceptOrder(before.id, actorId)]);
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(results.filter(({ ok }) => !ok)).toEqual([{ ok: false, error: "INVALID_TRANSITION" }]);
    expect(await prisma.auditLog.count({ where: { entityId: before.id, action: "order.accept" } })).toBe(1);
  }
});
it.each(states)("void on %s follows the business rules", async (status) => {
  const before = await order(status); const line = before.lines[0];
  const allowed = ["PREPARING", "READY", "SERVED"].includes(status);
  expect(await voidLine(line.id, "Made twice", actorId)).toEqual(allowed ? { ok: true } : { ok: false, error: "INVALID_TRANSITION" });
  const after = await prisma.orderLine.findUniqueOrThrow({ where: { id: line.id } });
  if (allowed) {
    expect(after).toMatchObject({ voidedAt: expect.any(Date), voidReason: "Made twice", voidedById: actorId });
    expect(await voidLine(line.id, "Made twice", actorId)).toEqual({ ok: false, error: "INVALID_TRANSITION" });
    expect(await prisma.auditLog.findMany({ where: { entityId: line.id } })).toMatchObject([{ actorId, action: "order.void_line" }]);
  } else expect(after).toEqual(line);
});
it("void requires a reason and concurrent voids audit once", async () => {
  const before = await order("PREPARING"); const line = before.lines[0];
  expect(await voidLine(line.id, " ", actorId)).toEqual({ ok: false, error: "REASON_REQUIRED" });
  const results = await Promise.all([voidLine(line.id, "Made twice", actorId), voidLine(line.id, "Made twice", actorId)]);
  expect(results.filter(({ ok }) => ok)).toHaveLength(1);
  expect(await prisma.auditLog.count({ where: { entityId: line.id } })).toBe(1);
});
it("missing orders and lines return NOT_FOUND", async () => {
  for (const step of steps) expect(await step.run("absent")).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await voidLine("absent", "Made twice", actorId)).toEqual({ ok: false, error: "NOT_FOUND" });
});
it("a failed audit rolls the transition and void back", async () => {
  const before = await order();
  await expect(acceptOrder(before.id, "absent-actor")).rejects.toThrow();
  expect(await prisma.order.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({ status: "NEW", acceptedAt: null });
  const preparing = await order("PREPARING");
  await expect(voidLine(preparing.lines[0].id, "Made twice", "absent-actor")).rejects.toThrow();
  expect(await prisma.orderLine.findUniqueOrThrow({ where: { id: preparing.lines[0].id } })).toMatchObject({ voidedAt: null, voidReason: null, voidedById: null });
});
it("anonymous actions reject before mutating; staff actions derive their actor", async () => {
  const before = await order(); asAnonymous();
  for (const call of [() => actions.acceptOrder(before.id), () => actions.rejectOrder(before.id, "Kitchen closed"),
    () => actions.markReady(before.id), () => actions.markServed(before.id), () => actions.voidLine(before.lines[0].id, "Made twice")]) {
    expect(await call()).toEqual({ ok: false, error: "FORBIDDEN" });
  }
  expect(await prisma.order.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({ status: "NEW" });
  await asStaff(); expect(await actions.acceptOrder(before.id)).toEqual({ ok: true });
  expect(await prisma.auditLog.findFirstOrThrow({ where: { entityId: before.id } })).toMatchObject({ actorId });
});
