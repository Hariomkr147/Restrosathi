/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { prisma } from "../db";
import { settleBill } from "../billing/settle";
import { cancelBill } from "../billing/cancel";
import { upsertCustomer } from "../customers";
import { getBalance, applyRedemption, adjustPoints } from "./index";

beforeAll(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.loyaltyTxn.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoiceCounter.deleteMany();
  
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      loyaltyEnabled: true,
      loyaltyEarnPer100Rupees: 1,
      loyaltyRedeemUnitPoints: 100,
      loyaltyRedeemUnitValuePaise: 5000
    }
  });
});

afterEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.loyaltyTxn.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoiceCounter.deleteMany();
  
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      loyaltyEnabled: true,
      loyaltyEarnPer100Rupees: 1,
      loyaltyRedeemUnitPoints: 100,
      loyaltyRedeemUnitValuePaise: 5000
    }
  });
});

async function createBill(totalPaise: number, customerPhone: string | null, verified: boolean) {
  const session = await prisma.diningSession.create({
    data: { kind: "DINE_IN" }
  });
  const bill = await prisma.bill.create({
    data: {
      sessionId: session.id,
      docType: "BILL",
      taxMode: "NONE",
      gstRatePercent: 0,
      pricesIncludeTax: false,
      header: {},
      subtotalPaise: totalPaise,
      taxableValuePaise: totalPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      discountPaise: 0,
      roundOffPaise: 0,
      totalPaise: totalPaise,
      customerPhone,
      phoneVerifiedAt: verified ? new Date() : null,
      generatedById: "staff1"
    }
  });
  await prisma.billLine.create({
    data: {
      billId: bill.id,
      name: "Item",
      modifiers: {},
      qty: 1,
      unitPricePaise: totalPaise,
      linePaise: totalPaise
    }
  });
  return bill;
}

describe("loyalty ledger integration", () => {
  test("settling verified customer's bill earns points once", async () => {
    const bill = await createBill(25000, "9999911111", true);
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 25000 }], { id: "staff1" }, { expectedTotalPaise: 25000 });
    
    const customer = await prisma.customer.findUnique({ where: { phone: "+919999911111" } });
    expect(customer).not.toBeNull();
    
    const balance = await getBalance(customer!.id);
    expect(balance).toBe(2);
    
    const txns = await prisma.loyaltyTxn.findMany({ where: { billId: bill.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0].kind).toBe("EARN");
    expect(txns[0].points).toBe(2);
  });
  
  test("unverified phone earns nothing", async () => {
    const bill = await createBill(25000, "9999911111", false);
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 25000 }], { id: "staff1" }, { expectedTotalPaise: 25000 });
    const txns = await prisma.loyaltyTxn.findMany({ where: { billId: bill.id } });
    expect(txns).toHaveLength(0);
  });
  
  test("loyalty off earns nothing", async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { loyaltyEnabled: false } });
    const bill = await createBill(25000, "9999911111", true);
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 25000 }], { id: "staff1" }, { expectedTotalPaise: 25000 });
    const txns = await prisma.loyaltyTxn.findMany({ where: { billId: bill.id } });
    expect(txns).toHaveLength(0);
  });

  test("redemption of 100 points with balance 150 applies discount and after settlement ledger is +earned -100", async () => {
    const c = await upsertCustomer("9999922222", { name: "Test" }, prisma);
    await prisma.loyaltyTxn.create({
      data: { customerId: c.id, kind: "ADJUST", points: 150, note: "init", actorId: "owner" }
    });
    
    const bill = await createBill(20000, "+919999922222", true);
    await applyRedemption(bill.id, 100, "staff1");
    
    const updatedBill = await prisma.bill.findUnique({ where: { id: bill.id } });
    expect(updatedBill!.loyaltyPointsRedeemed).toBe(100);
    expect(updatedBill!.loyaltyDiscountPaise).toBe(5000);
    expect(updatedBill!.totalPaise).toBe(15000);
    
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 15000 }], { id: "staff1" }, { expectedTotalPaise: 15000 });
    
    const txns = await prisma.loyaltyTxn.findMany({ where: { billId: bill.id }, orderBy: { points: 'asc' } });
    expect(txns).toHaveLength(2);
    // REDEEM (-100) and EARN (1 for 15000 remaining)
    expect(txns.find(t => t.kind === "REDEEM")!.points).toBe(-100);
    expect(txns.find(t => t.kind === "EARN")!.points).toBe(1);
    
    const balance = await getBalance(c.id);
    expect(balance).toBe(150 - 100 + 1); // 51
  });

  test("redemption above balance refused", async () => {
    const c = await upsertCustomer("9999933333", { name: "Test" }, prisma);
    await prisma.loyaltyTxn.create({
      data: { customerId: c.id, kind: "ADJUST", points: 50, note: "init", actorId: "owner" }
    });
    
    const bill = await createBill(20000, "+919999933333", true);
    await expect(applyRedemption(bill.id, 100, "staff1")).rejects.toThrow("INSUFFICIENT_BALANCE");
  });
  
  test("cancelling a settled bill reverses its EARN and REDEEM exactly once", async () => {
    const c = await upsertCustomer("9999944444", { name: "Test" }, prisma);
    await prisma.loyaltyTxn.create({
      data: { customerId: c.id, kind: "ADJUST", points: 100, note: "init", actorId: "owner" }
    });
    
    const bill = await createBill(20000, "+919999944444", true);
    await applyRedemption(bill.id, 100, "staff1");
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 15000 }], { id: "staff1" }, { expectedTotalPaise: 15000 });
    
    const preCancelBalance = await getBalance(c.id);
    expect(preCancelBalance).toBe(1); // 100 - 100 + 1 (earned)
    
    await prisma.user.create({ data: { id: "owner", role: "OWNER", name: "O", passwordHash: "x" } });
    await cancelBill(bill.id, "Test cancellation", { id: "owner", role: "OWNER" });
    
    const postCancelBalance = await getBalance(c.id);
    expect(postCancelBalance).toBe(100);
    
    // Double cancel should not double reverse
    await cancelBill(bill.id, "Test cancellation 2", { id: "owner", role: "OWNER" });
    const postDoubleCancelBalance = await getBalance(c.id);
    expect(postDoubleCancelBalance).toBe(100);
  });
  
  test("adjust is owner-only and audited", async () => {
    const c = await upsertCustomer("9999955555", { name: "Test" }, prisma);
    await expect(adjustPoints(c.id, 10, "test", { id: "staff1", role: "STAFF" })).rejects.toThrow("UNAUTHORIZED");
    
    await adjustPoints(c.id, 10, "test", { id: "owner1", role: "OWNER" });
    const auditLog = await prisma.auditLog.findFirst({ where: { action: "loyalty.adjust" } });
    expect(auditLog).not.toBeNull();
    expect((auditLog!.data as any).delta).toBe(10);
  });
});
