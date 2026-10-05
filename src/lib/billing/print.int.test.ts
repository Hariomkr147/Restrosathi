import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db";
import { getBillPrint } from "./print";
import { generateBill } from "./generate";
import { settleBill } from "./settle";
import { createStaffOrder } from "../orders/staff-order";
import { cancelBill } from "./cancel";
import { randomUUID } from "crypto";
describe("getBillPrint", () => {
  let ownerId: string;
  
  beforeEach(async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    ownerId = owner.id;
  });

  it("extracts totals and lines, handles GSTIN correctly, rejects anonymous", async () => {
    const s = await prisma.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o = await prisma.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await prisma.orderLine.create({ data: { orderId: o.id, nameSnapshot: { en: "Test Item" }, modifiersSnapshot: {}, qty: 1, unitPricePaise: 100 } });
    
    await prisma.order.updateMany({ where: { sessionId: s.id }, data: { status: "PREPARING" } });
    
    // Test NONE taxMode
    await prisma.settings.update({ where: { id: 1 }, data: { taxMode: "NONE", gstin: "22AAAAA0000A1Z5" } });
    const b1 = await generateBill(s.id, {}, { id: ownerId, role: "OWNER" });
    if (!b1.ok) throw new Error();
    
    let print = await getBillPrint(b1.billId, { id: ownerId, role: "OWNER" });
    expect(print).not.toBeNull();
    expect(print?.title).toBe("Bill");
    expect(print?.header.gstin).toBeUndefined(); // Stripped for NONE
    
    // Change settings - should NOT affect already generated bill snapshot
    await prisma.settings.update({ where: { id: 1 }, data: { taxMode: "REGULAR", name: "Changed Name" } });
    let printAfterChange = await getBillPrint(b1.billId, { id: ownerId, role: "OWNER" });
    expect(printAfterChange?.header.name).not.toBe("Changed Name"); // should be original snapshot
    
    // Test REGULAR taxMode
    const b2 = await generateBill(s.id, {}, { id: ownerId, role: "OWNER" });
    if (!b2.ok) throw new Error();
    print = await getBillPrint(b2.billId, { id: ownerId, role: "OWNER" });
    expect(print?.title).toBe("Tax Invoice");
    expect(print?.header.gstin).toBe("22AAAAA0000A1Z5");
    expect(print?.taxLines.some(l => l.label.includes("CGST 2.5%"))).toBe(true);
    
    // Cancelled bill
    const bill2 = await prisma.bill.findUniqueOrThrow({ where: { id: b2.billId } });
    const sRes = await settleBill(b2.billId, [{ method: "CASH", amountPaise: bill2.totalPaise }], { id: ownerId }, { expectedTotalPaise: bill2.totalPaise });
    if (!sRes.ok) throw new Error();
    await cancelBill(b2.billId, "Test Cancel", { id: ownerId, role: "OWNER" });
    
    print = await getBillPrint(b2.billId, { id: ownerId, role: "OWNER" });
    expect(print?.status).toBe("CANCELLED");
    expect(print?.cancelledAt).toBeDefined();
    
    // Unknown ID
    const unk = await getBillPrint("nonexistent", { id: ownerId, role: "OWNER" });
    expect(unk).toBeNull();
    
    const anon = await getBillPrint(b2.billId, { id: "0", role: "ANONYMOUS" });
    expect(anon).toBeNull();
  });
});
