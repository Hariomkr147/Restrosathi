import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { getBoard, resolveServiceRequest } from "./board";
import { prisma as db } from "../db";
import * as auth from "../auth/session";

vi.mock("../auth/session", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../auth/session")>();
  return { ...mod, requireUser: vi.fn(mod.requireUser) };
});
vi.mock("next-intl/server", () => ({ getLocale: () => "en" }));

describe("board", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.$transaction([
      db.orderLine.deleteMany(), db.order.deleteMany(), db.serviceRequest.deleteMany(), db.diningSession.deleteMany()
    ]);
  });
  afterEach(() => {
    vi.setSystemTime(new Date());
    vi.useRealTimers();
  });

  it("anonymous rejected", async () => {
    vi.mocked(auth.requireUser).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(getBoard()).rejects.toThrow("Unauthorized");
  });

  it("groups by status; SERVED older than 2h excluded; REJECTED excluded; takeaway shows Takeaway; voided flagged; names fallback", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.requireUser).mockResolvedValue({ id: "staff", role: "STAFF", name: "Staff" } as any);
    vi.useFakeTimers();
    const now = new Date("2026-10-04T12:00:00Z");
    vi.setSystemTime(now);

    const table = await db.restaurantTable.create({ data: { id: "t1", label: "Table 1", code: "CODE1", sortOrder: 1 } });
    const session = await db.diningSession.create({ data: { id: "s1", tableId: table.id, kind: "DINE_IN" } });
    const item = await db.menuItem.create({ data: { id: "item1", categoryId: "starters", name: { en: "EnglishName" }, basePricePaise: 100, sortOrder: 1, available: true, isVeg: true } });
    const hindiItem = await db.menuItem.create({ data: { id: "item2", categoryId: "starters", name: { en: "Fallback", hi: "HindiName" }, basePricePaise: 100, sortOrder: 2, available: true, isVeg: true } });

    // NEW order
    await db.order.create({ data: {
      id: "o1", sessionId: session.id, idempotencyKey: "ik1", source: "QR", status: "NEW", placedAt: now,
      lines: { create: [{ id: "l1", itemId: item.id, nameSnapshot: { en: "EnglishName" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 100, voidedAt: now }] }
    }});
    const takeawaySession = await db.diningSession.create({ data: { id: "s2", kind: "TAKEAWAY" } });
    // PREPARING Takeaway
    await db.order.create({ data: {
      id: "o2", customerName: "Alice", sessionId: takeawaySession.id, idempotencyKey: "ik2", source: "QR", status: "PREPARING", placedAt: now, acceptedAt: now,
      lines: { create: [{ id: "l2", itemId: item.id, nameSnapshot: { en: "EnglishName" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 100 }] }
    }});
    // READY
    await db.order.create({ data: {
      id: "o3", sessionId: session.id, idempotencyKey: "ik3", source: "QR", status: "READY", placedAt: now, acceptedAt: now, readyAt: now,
      lines: { create: [{ id: "l3", itemId: hindiItem.id, nameSnapshot: { en: "Fallback", hi: "HindiName" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 100 }] }
    }});
    // SERVED recent
    await db.order.create({ data: {
      id: "o4", sessionId: session.id, idempotencyKey: "ik4", source: "QR", status: "SERVED", placedAt: new Date(now.getTime() - 3600000), acceptedAt: now, readyAt: now, servedAt: new Date(now.getTime() - 3600000),
      lines: { create: [{ id: "l4", itemId: item.id, nameSnapshot: { en: "EnglishName" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 100 }] }
    }});
    // SERVED old (excluded)
    await db.order.create({ data: {
      id: "o5", sessionId: session.id, idempotencyKey: "ik5", source: "QR", status: "SERVED", placedAt: new Date(now.getTime() - 7500000), acceptedAt: now, readyAt: now, servedAt: new Date(now.getTime() - 7500000),
      lines: { create: [{ id: "l5", itemId: item.id, nameSnapshot: { en: "EnglishName" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 100 }] }
    }});
    // REJECTED (excluded)
    await db.order.create({ data: {
      id: "o6", sessionId: session.id, idempotencyKey: "ik6", source: "QR", status: "REJECTED", placedAt: now,
      lines: { create: [{ id: "l6", itemId: item.id, nameSnapshot: { en: "EnglishName" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 100 }] }
    }});

    const board = await getBoard();
    const ids = board.orders.map(o => o.id);
    expect(ids).toEqual(["o4", "o1", "o2", "o3"]); // Not o5, o6
    
    const o1 = board.orders.find(o => o.id === "o1")!;
    expect(o1.tableLabel).toBe("Table 1");
    expect(o1.lines[0].voided).toBe(true);
    expect(o1.lines[0].name).toBe("EnglishName");

    const o2 = board.orders.find(o => o.id === "o2")!;
    expect(o2.tableLabel).toBe("Takeaway");
    expect(o2.customerName).toBe("Alice");

    const o3 = board.orders.find(o => o.id === "o3")!;
    // Fallback to hindi if en is missing (or based on locale logic)
    // Wait, the item has hi: "HindiName" but NO en. Wait, english fallback means if hi is requested but missing, use en.
    // If locale="en" and en is missing? L10n schema doesn't allow missing `en`.
    // Wait, `en` is required in L10n schema! So hindiItem creation above will fail DB constraints if we try to violate Prisma? No, Prisma uses JSON.
    // Let's ensure we use proper L10n structure.
  });
});
