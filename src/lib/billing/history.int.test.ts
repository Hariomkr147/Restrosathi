import { resetOperationalData } from "../../../tests/helpers/db";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../db";
import { listBills } from "./history";
import { generateBill } from "./generate";
import { settleBill } from "./settle";
import { cancelBill } from "./cancel";
import { createStaffOrder } from "../orders/staff-order";
import { randomUUID } from "crypto";

describe("history", () => {
  let ownerId: string;
  let staffId: string;
  let tableId: string;

  beforeEach(async () => {
    await resetOperationalData();
    await prisma.menuItem.deleteMany({ where: { id: "test-item-hist" } });
    await prisma.category.deleteMany({ where: { id: "test-cat-hist" } });
    await prisma.restaurantTable.deleteMany({ where: { code: "T1_HIST" } });

    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
    
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF" } });
    staffId = staff.id;

    const t = await prisma.restaurantTable.create({ data: { code: "T1_HIST", label: "T1_HIST" } });
    tableId = t.id;

    const m = await prisma.menuItem.create({
      data: {
        id: "test-item-hist",
        name: { en: "Test Item" },
        basePricePaise: 10000,
        available: true,
        isVeg: true,
        category: { create: { id: "test-cat-hist", name: { en: "Cat" }, sortOrder: 0 } },
        sortOrder: 0
      }
    });

    // Create 3 bills: 
    // 1. Settled today
    // 2. Cancelled today
    // 3. Settled yesterday
    const makeBill = async (date: Date) => {
      vi.useFakeTimers();
      vi.setSystemTime(date);

      const res = await createStaffOrder({
        target: { type: "TABLE", tableId },
        idempotencyKey: randomUUID(),
        items: [{ itemId: m.id, qty: 1, optionIds: [] }]
      }, staffId);
      if (!res.ok) throw new Error("Order failed");
      const sessionId = res.sessionId;
      await prisma.order.updateMany({ where: { sessionId }, data: { status: "PREPARING", acceptedAt: date } });

      const bRes = await generateBill(sessionId, {}, { id: ownerId, role: "OWNER" });
      if (!bRes.ok) throw new Error("Bill failed");
      const bill = await prisma.bill.findUniqueOrThrow({ where: { id: bRes.billId } });
      const sRes = await settleBill(bRes.billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill.totalPaise, now: date });
      if (!sRes.ok) throw new Error("Settle failed");
      
      vi.useRealTimers();
      return { billId: bRes.billId, number: sRes.number };
    };

    // Today IST: let's pick 12 PM IST
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const yyyy = nowIST.getFullYear();
    const mm = nowIST.getMonth();
    const dd = nowIST.getDate();
    
    const todayMid = new Date(Date.UTC(yyyy, mm, dd, 12, 0, 0));
    todayMid.setMinutes(todayMid.getMinutes() - 330);

    const yesterdayMid = new Date(todayMid);
    yesterdayMid.setUTCDate(yesterdayMid.getUTCDate() - 1);

    const b1 = await makeBill(todayMid);
    const b2 = await makeBill(todayMid);
    await cancelBill(b2.billId, "Test cancel", { id: ownerId, role: "OWNER" });
    const b3 = await makeBill(yesterdayMid);
  });

  it("lists only that IST day", async () => {
    const res = await listBills({}, { id: ownerId, role: "OWNER" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.bills).toHaveLength(2); // b1 and b2
    const statuses = res.bills.map(b => b.status).sort();
    expect(statuses).toEqual(["CANCELLED", "SETTLED"]);
  });

  it("search by number works", async () => {
    // Should get invoice /0002 which was cancelled
    const res = await listBills({ query: "0002" }, { id: staffId, role: "STAFF" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.bills).toHaveLength(1);
    expect(res.bills[0].number).toContain("0002");
    expect(res.bills[0].status).toBe("CANCELLED");
  });

  it("anonymous rejected", async () => {
    const res = await listBills({}, { id: "0", role: "ANONYMOUS" } as unknown as { id: string, role: string });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("FORBIDDEN");
  });
});
