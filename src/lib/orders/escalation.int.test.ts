/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, beforeEach } from "vitest";
import { prisma } from "../db";
import { escalateStaleOrders } from "./escalation";

beforeEach(async () => {
  await prisma.messageLog.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.diningSession.deleteMany({});
  await prisma.restaurantTable.deleteMany({});
  await prisma.settings.update({
    where: { id: 1 },
    data: { ownerAlertPhone: "+919999911111" }
  });
});

test("escalates stale orders and sends one message", async () => {
  const table1 = await prisma.restaurantTable.create({ data: { label: "3", code: "3" } });
  const table2 = await prisma.restaurantTable.create({ data: { label: "5", code: "5" } });
  
  const sess1 = await prisma.diningSession.create({ data: { tableId: table1.id, status: "OPEN", kind: "DINE_IN" } });
  const sess2 = await prisma.diningSession.create({ data: { tableId: table2.id, status: "OPEN", kind: "DINE_IN" } });
  
  const now = new Date("2026-10-10T12:00:00Z");
  
  // Stale 3 min
  const o1 = await prisma.order.create({
    data: { sessionId: sess1.id, source: "QR", status: "NEW", idempotencyKey: "1", placedAt: new Date(now.getTime() - 180_000) }
  });
  
  // Stale 2 min
  const o2 = await prisma.order.create({
    data: { sessionId: sess2.id, source: "QR", status: "NEW", idempotencyKey: "2", placedAt: new Date(now.getTime() - 120_000) }
  });
  
  // Fresh 1 min
  await prisma.order.create({
    data: { sessionId: sess2.id, source: "QR", status: "NEW", idempotencyKey: "3", placedAt: new Date(now.getTime() - 60_000) }
  });

  const res = await escalateStaleOrders({ now, thresholdMs: 120_000 });
  expect(res.escalated).toBe(2);
  
  // They should be marked
  const escalated = await prisma.order.findMany({ where: { escalatedAt: { not: null } } });
  expect(escalated).toHaveLength(2);
  
  // One message queued
  const msgs = await prisma.messageLog.findMany({ where: { kind: "ORDER_ESCALATION" } });
  expect(msgs).toHaveLength(1);
  expect((msgs[0].params as any).text).toContain("2 orders waiting: Table 3 (3 min), Table 5 (2 min)");
});

test("no owner phone -> returns 0", async () => {
  await prisma.settings.update({
    where: { id: 1 },
    data: { ownerAlertPhone: null }
  });
  const res = await escalateStaleOrders();
  expect(res.escalated).toBe(0);
});
