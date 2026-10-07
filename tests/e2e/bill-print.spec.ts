import { test, expect } from "@playwright/test";
import { db, resetOperationalData } from "../helpers/db";
import { randomUUID } from "crypto";
import { createSettledBill } from "../helpers/billing";

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
    const bill1 = await createSettledBill(s.id, 100, "REGULAR");

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
    await db.bill.update({ where: { id: bill1.id }, data: { status: "CANCELLED", cancelReason: "Test" } });
    await page.reload();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();

    // NONE Bill
    await db.settings.update({ where: { id: 1 }, data: { taxMode: "NONE", gstin: "REG123" } });
    
    const s2 = await db.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const bill2 = await createSettledBill(s2.id, 100, "NONE");
    
    await page.goto(`/admin/bills/view/${bill2.id}/print`);
    await expect(page.getByText("Bill", { exact: true })).toBeVisible();
    await expect(page.getByText("GSTIN")).toBeHidden();
  });
});
