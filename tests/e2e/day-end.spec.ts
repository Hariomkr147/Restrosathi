import { test, expect } from "@playwright/test";
import { db, resetOperationalData } from "../helpers/db";
import { generateBill } from "../../src/lib/billing/generate";
import { settleBill } from "../../src/lib/billing/settle";
import { randomUUID } from "crypto";

test.describe("Day End Report", () => {
  test.beforeEach(async () => { await resetOperationalData(); });
  test.afterAll(async () => { await resetOperationalData(); await db.$disconnect(); });

  test("owner sees day end report with totals", async ({ page }) => {
    // Create a settled bill today
    const s = await db.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o = await db.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await db.orderLine.create({ data: { orderId: o.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 50000 } }); // 500.00
    
    const owner = await db.user.findFirstOrThrow({ where: { role: "OWNER" } });
    const bRes = await generateBill(s.id, {}, { id: owner.id, role: "OWNER" });
    if (!bRes.ok) throw new Error();
    const bill = await db.bill.findUniqueOrThrow({ where: { id: bRes.billId } });
    await settleBill(bill.id, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: owner.id }, { expectedTotalPaise: bill.totalPaise });

    // Login as owner
    await page.goto("/login/owner");
    await page.fill("input[name=password]", process.env.SEED_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    
    // Go to Day End
    await page.goto("/admin/reports/day-end");
    
    await expect(page.getByRole("heading", { name: "Day End Report" })).toBeVisible();
    await expect(page.getByText("500.00").first()).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible(); // billCount
  });

  test("staff forbidden", async ({ page }) => {
    await page.goto("/login/staff");
    await page.getByLabel("Staff member").selectOption({ label: "Ravi" });
    await page.waitForTimeout(500);
    await page.fill("input[name=pin]", process.env.SEED_STAFF_PIN!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    
    await page.goto("/admin/reports/day-end");
    await expect(page).toHaveURL(/.*\/admin\/board/); // Redirected
  });
});
