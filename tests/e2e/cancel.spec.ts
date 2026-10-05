import { test, expect } from "@playwright/test";
import { db, resetOperationalData } from "../helpers/db";
import { generateBill } from "../../src/lib/billing/generate";
import { settleBill } from "../../src/lib/billing/settle";
import { randomUUID } from "crypto";

test.describe("Cancel Bill", () => {
  let billId: string;
  let invoiceNumber: string;

  test.beforeEach(async () => {
    await resetOperationalData();
    // create a settled bill
    const s = await db.diningSession.create({ data: { kind: "TAKEAWAY" } });
    const o = await db.order.create({ data: { sessionId: s.id, idempotencyKey: randomUUID(), source: "QR", status: "PREPARING" } });
    await db.orderLine.create({ data: { orderId: o.id, nameSnapshot: {}, modifiersSnapshot: {}, qty: 1, unitPricePaise: 100 } });
    
    const owner = await db.user.findFirstOrThrow({ where: { role: "OWNER" } });
    const bRes = await generateBill(s.id, {}, { id: owner.id, role: "OWNER" });
    if (!bRes.ok) throw new Error("b failed");
    
    billId = bRes.billId;
    const bill = await db.bill.findUniqueOrThrow({ where: { id: billId } });
    
    const sRes = await settleBill(billId, [{ method: "CASH", amountPaise: bill.totalPaise }], { id: owner.id }, { expectedTotalPaise: bill.totalPaise });
    if (!sRes.ok) throw new Error("s failed");
    invoiceNumber = sRes.number;
  });

  test.afterAll(async () => { await resetOperationalData(); await db.$disconnect(); });

  test("owner cancels from detail page", async ({ page }) => {
    await page.goto("/login/owner");
    await page.fill("input[name=password]", process.env.SEED_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/.*\/admin/);

    await page.goto(`/admin/bills/view/${billId}`);
    
    await expect(page.locator("h1")).toContainText(`Invoice ${invoiceNumber}`);
    
    const cancelBtn = page.getByRole("button", { name: "Cancel Bill" });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    
    const dialog = page.getByText("Are you sure you want to cancel this settled bill?");
    await expect(dialog).toBeVisible();
    
    await page.getByPlaceholder("Mistake in entry, customer dispute, etc.").fill("Mistake made");
    await page.getByRole("button", { name: "Confirm Cancel" }).click();
    
    await expect(page.getByText("Cancellation details")).toBeVisible();
    await expect(page.getByText("Reason: Mistake made")).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Cancelled$/ }).first()).toBeVisible();
    
    // Cancel button should be gone
    await expect(page.getByRole("button", { name: "Cancel Bill" })).toBeHidden();
  });

  test("staff sees no Cancel button, POST rejected", async ({ page }) => {
    await page.goto("/login/staff");
    await page.getByLabel("Staff member").selectOption({ label: "Ravi" });
    await page.waitForTimeout(500);
    await page.fill("input[name=pin]", process.env.SEED_STAFF_PIN!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/.*\/admin/);

    await page.goto(`/admin/bills/view/${billId}`);
    
    await expect(page.locator("h1")).toContainText(`Invoice ${invoiceNumber}`);
    await expect(page.getByRole("button", { name: "Cancel Bill" })).toBeHidden();
  });
});
