import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { generateBill } from "./generate";
import { settleBill } from "./settle";
import { getBillPrint } from "./print";
import { getDayEnd } from "./day-end";
import { getBillData } from "./queries";
import { getSessionView } from "../orders/session-view";
import { applyRedemption, getBalance, removeRedemption } from "../loyalty";
import { resetOperationalData } from "../../../tests/helpers/db";

describe("redeemed bill regeneration", () => {
  const phone = "+919876543210";
  const owner = { id: "owner-demo", role: "OWNER" };
  let sessionId: string;
  let billId: string;
  let customerId: string;
  let tableCode: string;

  beforeEach(async () => {
    await resetOperationalData();
    await prisma.settings.update({ where: { id: 1 }, data: {
      taxMode: "NONE", pricesIncludeTax: false, loyaltyEnabled: true,
      loyaltyEarnPer100Rupees: 1, loyaltyRedeemUnitPoints: 100, loyaltyRedeemUnitValuePaise: 5000,
    } });
    const customer = await prisma.customer.create({ data: { phone } });
    customerId = customer.id;
    await prisma.loyaltyTxn.create({ data: { customerId, kind: "ADJUST", points: 200, note: "Opening balance" } });
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { active: true } });
    tableCode = table.code;
    const session = await prisma.diningSession.create({ data: {
      kind: "DINE_IN", tableId: table.id, customerPhone: phone, customerPhoneVerifiedAt: new Date(),
    } });
    sessionId = session.id;
    await prisma.order.create({ data: {
      sessionId, idempotencyKey: randomUUID(), source: "STAFF", status: "SERVED",
      lines: { create: { nameSnapshot: { en: "Dal", hi: "दाल" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 20000 } },
    } });
    const generated = await generateBill(sessionId, {}, owner);
    if (!generated.ok) throw new Error(generated.error);
    billId = generated.billId;
    await applyRedemption(billId, 100, owner.id);
  });

  it("retains the discount and exactly one debit through regenerate, settle, print and day-end", async () => {
    expect(await generateBill(sessionId, {}, owner)).toEqual({ ok: true, billId });
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId } });
    expect(bill).toMatchObject({ totalPaise: 15000, discountPaise: 5000, loyaltyDiscountPaise: 5000, loyaltyPointsRedeemed: 100 });
    expect((await getBillData(sessionId))?.computed).toMatchObject({ totalPaise: 15000, discountPaise: 5000 });
    expect((await getSessionView(tableCode))?.bill).toMatchObject({ totalPaise: 15000, discountPaise: 5000, loyaltyDiscountPaise: 5000 });
    expect(await settleBill(billId, [{ method: "CASH", amountPaise: 15000 }], owner, { expectedTotalPaise: 15000 })).toMatchObject({ ok: true });
    expect(await getBalance(customerId)).toBe(101);
    expect(await prisma.loyaltyTxn.count({ where: { billId, kind: "REDEEM" } })).toBe(1);
    expect(await getBillPrint(billId, owner)).toMatchObject({ total: 15000, discount: { value: 5000 }, loyaltyDiscountPaise: 5000 });
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    expect(await getDayEnd(date, owner)).toMatchObject({ totalPaise: 15000, discountPaise: 5000, reconciles: true });
  });

  it("combines the saved manual discount and loyalty on repeated regeneration", async () => {
    await generateBill(sessionId, { discount: { type: "FLAT", value: 1000, reason: "Owner discount" } }, owner);
    await generateBill(sessionId, {}, owner);
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 14000, discountPaise: 6000, discountValue: 1000, loyaltyPointsRedeemed: 100 });
  });

  it("clears redemption and verification when the phone changes", async () => {
    await generateBill(sessionId, { customerPhone: "+919876543211" }, owner);
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 20000, discountPaise: 0, loyaltyPointsRedeemed: 0, loyaltyDiscountPaise: 0, phoneVerifiedAt: null });
  });

  it("clears the draft when loyalty is disabled and refuses settlement until recalculation", async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { loyaltyEnabled: false } });
    expect(await settleBill(billId, [{ method: "CASH", amountPaise: 15000 }], owner, { expectedTotalPaise: 15000 })).toEqual({ ok: false, error: "LOYALTY_DISABLED" });
    expect(await prisma.invoiceCounter.count()).toBe(0);
    await generateBill(sessionId, {}, owner);
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 20000, loyaltyDiscountPaise: 0, loyaltyPointsRedeemed: 0 });
    expect(await getBalance(customerId)).toBe(200);
  });

  it.each([1.5, -100, 0, 150])("rejects invalid points %s without changing the bill", async (points) => {
    await expect(applyRedemption(billId, points, owner.id)).rejects.toThrow();
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 15000, loyaltyPointsRedeemed: 100 });
  });

  it("removes a manual discount explicitly while retaining redemption", async () => {
    await generateBill(sessionId, { discount: { type: "PERCENT", value: 10, reason: "Owner discount" } }, owner);
    expect((await getBillPrint(billId, owner))?.discount?.value).toBe(7000);
    await generateBill(sessionId, { discount: null }, owner);
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 15000, discountType: null, loyaltyPointsRedeemed: 100 });
  });

  it("removes redemption through the same calculation and preserves the manual discount", async () => {
    await generateBill(sessionId, { discount: { type: "PERCENT", value: 10, reason: "Owner discount" } }, owner);
    expect(await removeRedemption(billId)).toBe(true);
    await generateBill(sessionId, {}, owner);
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 18000, discountPaise: 2000, loyaltyDiscountPaise: 0, loyaltyPointsRedeemed: 0 });
    expect(await getBalance(customerId)).toBe(200);
  });

  it("does not let staff without permission clear an owner's manual discount", async () => {
    await generateBill(sessionId, { discount: { type: "FLAT", value: 1000, reason: "Owner discount" } }, owner);
    await prisma.settings.update({ where: { id: 1 }, data: { staffCanDiscount: false } });
    const staff = { id: "staff-ravi", role: "STAFF" };
    expect(await generateBill(sessionId, { discount: null }, staff)).toMatchObject({ ok: false, error: "DISCOUNT_FORBIDDEN" });
    expect(await generateBill(sessionId, {}, staff)).toMatchObject({ ok: true });
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).totalPaise).toBe(14000);
  });

  it("rejects insufficient balance and excessive combined discounts atomically", async () => {
    await expect(applyRedemption(billId, 300, owner.id)).rejects.toThrow("INSUFFICIENT_BALANCE");
    expect(await generateBill(sessionId, { discount: { type: "FLAT", value: 16000, reason: "Too much" } }, owner)).toMatchObject({ ok: false });
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 15000, discountType: null });
  });

  it("rechecks the balance before allocation without debiting an unaffordable redemption", async () => {
    await prisma.loyaltyTxn.create({ data: { customerId, kind: "ADJUST", points: -150, note: "Balance changed" } });
    expect(await settleBill(billId, [{ method: "CASH", amountPaise: 15000 }], owner, { expectedTotalPaise: 15000 })).toMatchObject({ ok: false, error: "LOYALTY_BALANCE_CHANGED" });
    expect(await prisma.invoiceCounter.count()).toBe(0);
    expect(await prisma.loyaltyTxn.count({ where: { billId, kind: "REDEEM" } })).toBe(0);
  });

  it("refuses an inconsistent discounted snapshot before allocating an invoice", async () => {
    await prisma.bill.update({ where: { id: billId }, data: { discountPaise: 0, totalPaise: 20000 } });
    expect(await settleBill(billId, [{ method: "CASH", amountPaise: 20000 }], owner, { expectedTotalPaise: 20000 })).toMatchObject({ ok: false, error: "STALE_BILL" });
    expect(await prisma.invoiceCounter.count()).toBe(0);
  });

  it("refuses settlement after redemption settings change until the draft is updated", async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { loyaltyRedeemUnitValuePaise: 4000 } });
    expect(await settleBill(billId, [{ method: "CASH", amountPaise: 15000 }], owner, { expectedTotalPaise: 15000 })).toMatchObject({ ok: false, error: "LOYALTY_SETTINGS_CHANGED" });
    expect(await prisma.invoiceCounter.count()).toBe(0);
    await generateBill(sessionId, {}, owner);
    expect(await prisma.bill.findUniqueOrThrow({ where: { id: billId } })).toMatchObject({ totalPaise: 16000, loyaltyDiscountPaise: 4000 });
  });
});
