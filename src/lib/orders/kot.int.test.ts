import { expect, test, beforeAll, vi } from "vitest";
import { getKot } from "./kot";
import { prisma as db } from "../db";
import * as auth from "../auth/session";
import { resetOperationalData } from "../../../tests/helpers/db";

vi.mock("../auth/session", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../auth/session")>();
  return { ...mod, requireUser: vi.fn() };
});

beforeAll(async () => {
  await resetOperationalData();
  const staff = await db.user.create({ data: { name: "Staff", role: "STAFF" } });
  vi.mocked(auth.requireUser).mockResolvedValue(staff);
});

test("returns null for unknown id", async () => {
  const result = await getKot("unknown-id");
  expect(result).toBeNull();
});

test("returns KOT data for placed order, excluding voided lines", async () => {
  const table = await db.restaurantTable.findUniqueOrThrow({ where: { label: "T1" } });
  const session = await db.diningSession.create({ data: { id: "kot-sess1", tableId: table.id, kind: "DINE_IN", status: "OPEN" } });
  const order = await db.order.create({
    data: {
      id: "ord_1234ABCD",
      idempotencyKey: "1234abcd",
      sessionId: session.id,
      source: "QR",
      status: "NEW",
      customerName: "Alice",
      lines: {
        create: [
          {
            id: "line1",
            qty: 2,
            unitPricePaise: 100,
            nameSnapshot: { en: "Burger", hi: "बर्गर" },
            modifiersSnapshot: [{ en: "Extra Cheese", hi: "अतिरिक्त चीज़" }],
            note: "No onions"
          },
          {
            id: "line2",
            qty: 1,
            unitPricePaise: 50,
            nameSnapshot: { en: "Fries", hi: "फ्राइज़" },
            modifiersSnapshot: [],
            voidedAt: new Date(),
            voidReason: "Out of stock",
            voidedById: "some-user"
          }
        ]
      }
    }
  });

  const kot = await getKot(order.id, "en");
  expect(kot).not.toBeNull();
  expect(kot!.restaurantName).toBe("Saffron Tadka");
  expect(kot!.tableLabel).toBe("T1");
  expect(kot!.orderNo).toBe("ABCD");
  expect(kot!.customerName).toBe("Alice");
  expect(kot!.lines).toHaveLength(1); // line2 is voided
  expect(kot!.lines[0]).toEqual({
    qty: 2,
    name: "Burger",
    variant: null,
    modifiers: ["Extra Cheese"],
    note: "No onions"
  });

  const kotHi = await getKot(order.id, "hi");
  expect(kotHi!.lines[0].name).toBe("बर्गर");
  expect(kotHi!.lines[0].modifiers).toEqual(["अतिरिक्त चीज़"]);
});

test("takeaway session returns 'Takeaway'", async () => {
  const session = await db.diningSession.create({ data: { id: "kot-sess2", kind: "TAKEAWAY", status: "OPEN" } });
  const order = await db.order.create({
    data: {
      id: "ord_XYZ9876",
      idempotencyKey: "xyz9876",
      sessionId: session.id,
      source: "QR",
      status: "NEW",
      lines: {
        create: [
          {
            id: "line3",
            qty: 1,
            unitPricePaise: 10,
            nameSnapshot: { en: "Coke" },
            modifiersSnapshot: []
          }
        ]
      }
    }
  });

  const kot = await getKot(order.id);
  expect(kot!.tableLabel).toBe("Takeaway");
  expect(kot!.customerName).toBeNull();
});

test("returns null if REJECTED", async () => {
  const session = await db.diningSession.create({ data: { id: "kot-sess3", kind: "TAKEAWAY", status: "OPEN" } });
  const order = await db.order.create({
    data: {
      id: "ord_REJ",
      idempotencyKey: "rej",
      sessionId: session.id,
      source: "QR",
      status: "REJECTED",
      lines: {
        create: [
          {
            id: "line4",
            qty: 1,
            unitPricePaise: 10,
            nameSnapshot: { en: "Coke" },
            modifiersSnapshot: []
          }
        ]
      }
    }
  });

  const kot = await getKot(order.id);
  expect(kot).toBeNull();
});
