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
    await prisma.invoiceCounter.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.billLine.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.serviceRequest.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();
    await prisma.diningSession.deleteMany();
    await prisma.restaurantTable.deleteMany();
    await prisma.menuItem.deleteMany();

    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
    
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "STAFF" } });
    staffId = staff.id;

    const t = await prisma.restaurantTable.create({ data: { code: "T1", label: "T1" } });
    tableId = t.id;

    const m = await prisma.menuItem.create({
      data: {
        name: { en: "Test Item" },
        basePricePaise: 10000,
        available: true,
        isVeg: true,
        category: { create: { name: { en: "Cat" }, sortOrder: 0 } },
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
