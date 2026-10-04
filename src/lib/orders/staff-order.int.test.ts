import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "../db";
import { createStaffOrder } from "./staff-order";

let STAFF_ID: string;

describe("Staff Orders (Integration)", () => {
  beforeAll(async () => {
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF", active: true } });
    STAFF_ID = staff.id;
  });
  it("table order joins the existing session; second takeaway creates a separate session; order starts PREPARING with acceptedAt set and source STAFF", async () => {
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { code: "TESTCODE01" } });
    const dish = await prisma.menuItem.findFirstOrThrow({ where: { available: true, variants: { none: {} }, modifierGroups: { none: {} } } });

    // Table order
    const tableKey = crypto.randomUUID();
    const tableRes = await createStaffOrder({
      target: { type: "TABLE", tableId: table.id },
      idempotencyKey: tableKey,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    if (!tableRes.ok) console.log("TABLE RES ERROR", tableRes);
    expect(tableRes.ok).toBe(true);
    if (!tableRes.ok) throw new Error();

    const tableSession = await prisma.diningSession.findUniqueOrThrow({ where: { id: tableRes.sessionId } });
    expect(tableSession.tableId).toBe(table.id);

    // Join the existing session
    const tableKey2 = crypto.randomUUID();
    const tableRes2 = await createStaffOrder({
      target: { type: "TABLE", tableId: table.id },
      idempotencyKey: tableKey2,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    expect(tableRes2.ok).toBe(true);
    if (!tableRes2.ok) throw new Error();
    expect(tableRes2.sessionId).toBe(tableSession.id);

    // Takeaway order 1
    const takeawayKey1 = crypto.randomUUID();
    const takeawayRes1 = await createStaffOrder({
      target: { type: "TAKEAWAY", customerName: "Takeaway 1" },
      idempotencyKey: takeawayKey1,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    expect(takeawayRes1.ok).toBe(true);
    if (!takeawayRes1.ok) throw new Error();

    // Takeaway order 2
    const takeawayKey2 = crypto.randomUUID();
    const takeawayRes2 = await createStaffOrder({
      target: { type: "TAKEAWAY", customerName: "Takeaway 2" },
      idempotencyKey: takeawayKey2,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    expect(takeawayRes2.ok).toBe(true);
    if (!takeawayRes2.ok) throw new Error();
    expect(takeawayRes1.sessionId).not.toBe(takeawayRes2.sessionId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: tableRes.orderId } });
    expect(order.status).toBe("PREPARING");
    expect(order.source).toBe("STAFF");
    expect(order.acceptedAt).not.toBeNull();
  });

  it("sold-out item rejected; client price ignored", async () => {
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { code: "TESTCODE01" } });
    const dish = await prisma.menuItem.findFirstOrThrow({ where: { available: true, variants: { none: {} }, modifierGroups: { none: {} } } });
    await prisma.menuItem.update({ where: { id: dish.id }, data: { available: false } });

    const key = crypto.randomUUID();
    const res = await createStaffOrder({
      target: { type: "TABLE", tableId: table.id },
      idempotencyKey: key,
      items: [{ itemId: dish.id, optionIds: [], qty: 1, unitPricePaise: 1 }]
    }, STAFF_ID);

    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toBe("ITEM_UNAVAILABLE");

    // cleanup
    await prisma.menuItem.update({ where: { id: dish.id }, data: { available: true } });
  });

  it("duplicate key -> one order; concurrent same key -> one order", async () => {
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { code: "TESTCODE01" } });
    const dish = await prisma.menuItem.findFirstOrThrow({ where: { available: true, variants: { none: {} }, modifierGroups: { none: {} } } });
    const key = crypto.randomUUID();

    const input = {
      target: { type: "TABLE", tableId: table.id },
      idempotencyKey: key,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    };

    const results = await Promise.all([
      createStaffOrder(input, STAFF_ID),
      createStaffOrder(input, STAFF_ID),
      createStaffOrder(input, STAFF_ID)
    ]);

    expect(results.every(r => r.ok)).toBe(true);
    const orderIds = new Set(results.map(r => (r as { orderId: string }).orderId));
    expect(orderIds.size).toBe(1);

    const count = await prisma.order.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("inactive table rejected", async () => {
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { code: "TESTCODE01" } });
    await prisma.restaurantTable.update({ where: { id: table.id }, data: { active: false } });
    const dish = await prisma.menuItem.findFirstOrThrow({ where: { available: true, variants: { none: {} }, modifierGroups: { none: {} } } });

    const res = await createStaffOrder({
      target: { type: "TABLE", tableId: table.id },
      idempotencyKey: crypto.randomUUID(),
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);

    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toBe("TABLE_NOT_FOUND");

    // cleanup
    await prisma.restaurantTable.update({ where: { id: table.id }, data: { active: true } });
  });

  it("adding to an existing takeaway session works and adding to a CLOSED session is refused (SESSION_CLOSED)", async () => {
    const dish = await prisma.menuItem.findFirstOrThrow({ where: { available: true, variants: { none: {} }, modifierGroups: { none: {} } } });
    const takeawayKey1 = crypto.randomUUID();
    const takeawayRes1 = await createStaffOrder({
      target: { type: "TAKEAWAY", customerName: "Rahul" },
      idempotencyKey: takeawayKey1,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    if (!takeawayRes1.ok) throw new Error();

    // Add to existing
    const takeawayKey2 = crypto.randomUUID();
    const takeawayRes2 = await createStaffOrder({
      target: { type: "TAKEAWAY", sessionId: takeawayRes1.sessionId },
      idempotencyKey: takeawayKey2,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    expect(takeawayRes2.ok).toBe(true);
    if (!takeawayRes2.ok) throw new Error();
    expect(takeawayRes2.sessionId).toBe(takeawayRes1.sessionId);

    // Close session
    await prisma.diningSession.update({ where: { id: takeawayRes1.sessionId }, data: { status: "CLOSED" } });

    // Try adding to closed session
    const takeawayKey3 = crypto.randomUUID();
    const takeawayRes3 = await createStaffOrder({
      target: { type: "TAKEAWAY", sessionId: takeawayRes1.sessionId },
      idempotencyKey: takeawayKey3,
      items: [{ itemId: dish.id, optionIds: [], qty: 1 }]
    }, STAFF_ID);
    expect(takeawayRes3.ok).toBe(false);
    expect((takeawayRes3 as { error: string }).error).toBe("SESSION_CLOSED");
  });
});
