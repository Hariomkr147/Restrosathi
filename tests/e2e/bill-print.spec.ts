import { test, expect } from "@playwright/test";
import { db, resetOperationalData } from "../helpers/db";
import { generateBill } from "../../src/lib/billing/generate";
import { settleBill } from "../../src/lib/billing/settle";
import { cancelBill } from "../../src/lib/billing/cancel";
import { randomUUID } from "crypto";

test.describe("Bill Print 80mm", () => {
  test.beforeEach(async () => { await resetOperationalData(); });
  test.afterAll(async () => { await resetOperationalData(); await db.$disconnect(); });

  test("print page content fits 302px, respects tax mode, shows CANCELLED", async ({ page }) => {
    // Set up table, session, order
    const s = await db.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o = await db.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await db.orderLine.create({ data: { orderId: o.id, nameSnapshot: { en: "Test Item" }, modifiersSnapshot: {}, qty: 1, unitPricePaise: 100 } });
    
    const owner = await db.user.findFirstOrThrow({ where: { role: "OWNER" } });
    
    // REGULAR Bill
    await db.settings.update({ where: { id: 1 }, data: { taxMode: "REGULAR", gstin: "REG123" } });
    const bRes1 = await generateBill(s.id, {}, { id: owner.id, role: "OWNER" });
    if (!bRes1.ok) throw new Error();
    const bill1 = await db.bill.findUniqueOrThrow({ where: { id: bRes1.billId } });
    await settleBill(bill1.id, [{ method: "UPI", amountPaise: bill1.totalPaise }], { id: owner.id }, { expectedTotalPaise: bill1.totalPaise });

    // Login
    await page.goto("/login/owner");
    await page.fill("input[name=password]", process.env.SEED_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/.*\/admin/);

    // View print REGULAR
    await page.setViewportSize({ width: 302, height: 800 }); // ~80mm
    await page.goto(`/admin/bills/view/${bill1.id}/print`);
    
    await expect(page.getByText("Tax Invoice")).toBeVisible();
    await expect(page.getByText("GSTIN: REG123")).toBeVisible();
    
    // Check horizontal scroll (should not have horizontal scrollbar)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // allow 1px rounding

    // Check CANCELLED
    await cancelBill(bill1.id, "Test reason", { id: owner.id, role: "OWNER" });
    await page.reload();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();

    // NONE Bill
    await db.settings.update({ where: { id: 1 }, data: { taxMode: "NONE", gstin: "REG123" } });
    const bRes2 = await generateBill(s.id, {}, { id: owner.id, role: "OWNER" });
    if (!bRes2.ok) throw new Error();
    
    await page.goto(`/admin/bills/view/${bRes2.billId}/print`);
    await expect(page.getByText("Bill", { exact: true })).toBeVisible();
    await expect(page.getByText("GSTIN")).toBeHidden();
  });
});
