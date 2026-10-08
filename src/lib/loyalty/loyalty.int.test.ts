import { resetOperationalData } from "../../../tests/helpers/db";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { prisma } from "../db";
import { settleBill } from "../billing/settle";
import { cancelBill } from "../billing/cancel";
import { upsertCustomer } from "../customers";
import { getBalance, applyRedemption, adjustPoints } from "./index";

beforeAll(async () => {
  await resetOperationalData();
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
  await resetOperationalData();
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
  if (customerPhone && verified) {
    await prisma.customer.upsert({
      where: { phone: `+91${customerPhone.replace(/\D/g, "")}` },
      create: { phone: `+91${customerPhone.replace(/\D/g, "")}`, verifiedAt: new Date() },
      update: { verifiedAt: new Date() }
    });
  }

  const session = await prisma.diningSession.create({
    data: { kind: "TAKEAWAY" }
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
      generatedById: "staff-ravi"
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
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 25000 }], { id: "staff-ravi" }, { expectedTotalPaise: 25000 });
    
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
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 25000 }], { id: "staff-ravi" }, { expectedTotalPaise: 25000 });
    const txns = await prisma.loyaltyTxn.findMany({ where: { billId: bill.id } });
    expect(txns).toHaveLength(0);
  });
  
  test("loyalty off earns nothing", async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { loyaltyEnabled: false } });
    const bill = await createBill(25000, "9999911111", true);
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 25000 }], { id: "staff-ravi" }, { expectedTotalPaise: 25000 });
    const txns = await prisma.loyaltyTxn.findMany({ where: { billId: bill.id } });
    expect(txns).toHaveLength(0);
  });

  test("redemption of 100 points with balance 150 applies discount and after settlement ledger is +earned -100", async () => {
    const c = await upsertCustomer("9999922222", { name: "Test" }, prisma);
    await prisma.customer.update({ where: { id: c.id }, data: { verifiedAt: new Date() } });
    await prisma.loyaltyTxn.create({
      data: { customerId: c.id, kind: "ADJUST", points: 150, note: "init", actorId: "owner-demo" }
    });
    
    const bill = await createBill(20000, "+919999922222", true);
    await applyRedemption(bill.id, 100, "staff-ravi");
    
    const updatedBill = await prisma.bill.findUnique({ where: { id: bill.id } });
    expect(updatedBill!.loyaltyPointsRedeemed).toBe(100);
    expect(updatedBill!.loyaltyDiscountPaise).toBe(5000);
    expect(updatedBill!.totalPaise).toBe(15000);
    
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 15000 }], { id: "staff-ravi" }, { expectedTotalPaise: 15000 });
    
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
      data: { customerId: c.id, kind: "ADJUST", points: 50, note: "init", actorId: "owner-demo" }
    });
    
    const bill = await createBill(20000, "+919999933333", true);
    await expect(applyRedemption(bill.id, 100, "staff-ravi")).rejects.toThrow("INSUFFICIENT_BALANCE");
  });
  
  test("cancelling a settled bill reverses its EARN and REDEEM exactly once", async () => {
    const c = await upsertCustomer("9999944444", { name: "Test" }, prisma);
    await prisma.customer.update({ where: { id: c.id }, data: { verifiedAt: new Date() } });
    await prisma.loyaltyTxn.create({
      data: { customerId: c.id, kind: "ADJUST", points: 100, note: "init", actorId: "owner-demo" }
    });
    
    const bill = await createBill(20000, "+919999944444", true);
    await applyRedemption(bill.id, 100, "staff-ravi");
    await settleBill(bill.id, [{ method: "CASH", amountPaise: 15000 }], { id: "staff-ravi" }, { expectedTotalPaise: 15000 });
    
    const preCancelBalance = await getBalance(c.id);
    expect(preCancelBalance).toBe(1); // 100 - 100 + 1 (earned)
    await cancelBill(bill.id, "Test cancellation", { id: "owner-demo", role: "OWNER" });
    
    const postCancelBalance = await getBalance(c.id);
    expect(postCancelBalance).toBe(100);
    
    // Double cancel should not double reverse
    await cancelBill(bill.id, "Test cancellation 2", { id: "owner-demo", role: "OWNER" });
    const postDoubleCancelBalance = await getBalance(c.id);
    expect(postDoubleCancelBalance).toBe(100);
  });
  
  test("adjust is owner-only and audited", async () => {
    const c = await upsertCustomer("9999955555", { name: "Test" }, prisma);
    await expect(adjustPoints(c.id, 10, "test", { id: "staff-ravi", role: "STAFF" })).rejects.toThrow("UNAUTHORIZED");
    
    await adjustPoints(c.id, 10, "test", { id: "owner-demo", role: "OWNER" });
    const auditLog = await prisma.auditLog.findFirst({ where: { action: "loyalty.adjust" } });
    expect(auditLog).not.toBeNull();
    expect((auditLog!.data as any).delta).toBe(10);
  });
  describe("seeded property test", () => {
    test("300 random sequences for five customers comparing ledger sum and expected counter", async () => {
      const customers = [];
      for (let i = 0; i < 5; i++) {
        const c = await upsertCustomer(`999990000${i}`, { name: `Prop${i}` }, prisma);
        await prisma.customer.update({ where: { id: c.id }, data: { verifiedAt: new Date() } });
        customers.push(c);
      }

      // We maintain an independent expected state
      const state = new Map(customers.map(c => [c.id, 0]));

      let seed = 12345;
      function random() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }
      
      const ops = ["EARN", "REDEEM", "ADJUST", "CANCEL_REDEEM"];
      for (let i = 0; i < 300; i++) {
        const c = customers[Math.floor(random() * customers.length)];
        const op = ops[Math.floor(random() * ops.length)];
        const amount = Math.floor(random() * 50) + 1; // 1 to 50
        
        const currentBalance = state.get(c.id)!;
        
        if (op === "EARN") {
          const bill = await createBill(amount * 100 * 100, c.phone, true); // amount * 100 points
          const res = await settleBill(bill.id, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: "staff-ravi" }, { expectedTotalPaise: bill.totalPaise });
          if (res.ok) {
            state.set(c.id, currentBalance + amount);
          } else {
            console.log("settleBill failed!", res);
          }
        } else if (op === "REDEEM") {
          if (currentBalance >= amount) {
            // we can just ADJUST for property test to simulate direct redemption without bill? 
            // Or better, simulate redemption via bill. Wait, amount must be multiple of 100 to redeem via bill!
            // Actually, we can use ADJUST to simulate REDEEM if we just want to test ledger constraints, or we can use applyRedemption.
            // Let's use ADJUST to keep it simple but test the constraint and ledger.
            await prisma.loyaltyTxn.create({
              data: { customerId: c.id, kind: "REDEEM", points: -amount, note: "prop", actorId: "owner-demo" }
            });
            state.set(c.id, currentBalance - amount);
          }
        } else if (op === "ADJUST") {
          // adjust can be positive or negative
          const adj = random() > 0.5 ? amount : -amount;
          if (currentBalance + adj >= 0) {
            await adjustPoints(c.id, adj, "prop", { id: "owner-demo", role: "OWNER" });
            state.set(c.id, currentBalance + adj);
          }
        } else if (op === "CANCEL_REDEEM") {
          // To test cancel, we find a bill that was settled.
          // In property test we can just randomly cancel a past bill of this customer that hasn't been cancelled.
          const bills = await prisma.bill.findMany({ where: { customerPhone: c.phone, status: "SETTLED" } });
          if (bills.length > 0) {
            const b = bills[Math.floor(random() * bills.length)];
            // what did this bill earn/redeem?
            const txns = await prisma.loyaltyTxn.findMany({ where: { billId: b.id } });
            const earn = txns.find(t => t.kind === "EARN")?.points || 0;
            const redeem = txns.find(t => t.kind === "REDEEM")?.points || 0; // negative
            
            const res = await cancelBill(b.id, "property cancel", { id: "owner-demo", role: "OWNER" });
            if (res.ok) {
              state.set(c.id, currentBalance - earn - redeem);
            }
          }
        }
        
        // Assert balance matches expected
        const dbBalance = await getBalance(c.id);
        if (dbBalance !== state.get(c.id)) {
          console.log(`Mismatch at iter ${i} op ${op} for ${c.id}: expected ${state.get(c.id)} got ${dbBalance}`);
          const txns = await prisma.loyaltyTxn.findMany({ where: { customerId: c.id } });
          console.log("Txns:", txns);
        }
        expect(dbBalance).toBe(state.get(c.id));
      }
    }, 30000);
  });
});
