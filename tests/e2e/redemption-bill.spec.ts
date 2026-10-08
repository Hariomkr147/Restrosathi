import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, resetOperationalData, TABLE_CODES } from "../helpers/db";
import { generateBill } from "../../src/lib/billing/generate";
import { applyRedemption } from "../../src/lib/loyalty";

test.beforeEach(async () => { await resetOperationalData(); });

test("redeemed totals and bilingual breakdown agree at customer, staff and 80mm widths", async ({ page }, info) => {
  await db.settings.update({ where: { id: 1 }, data: { taxMode: "NONE", pricesIncludeTax: false, loyaltyEnabled: true } });
  const phone = "+919876543210";
  const customer = await db.customer.create({ data: { phone } });
  await db.loyaltyTxn.create({ data: { customerId: customer.id, kind: "ADJUST", points: 200, note: "Test balance" } });
  const table = await db.restaurantTable.findUniqueOrThrow({ where: { code: TABLE_CODES[0] } });
  const session = await db.diningSession.create({ data: { kind: "DINE_IN", tableId: table.id, customerPhone: phone, customerPhoneVerifiedAt: new Date() } });
  await db.order.create({ data: { sessionId: session.id, idempotencyKey: randomUUID(), source: "STAFF", status: "SERVED",
    lines: { create: { nameSnapshot: { en: "Dal with a long descriptive name", hi: "लंबे नाम वाली स्वादिष्ट दाल" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 20000 } } } });
  const owner = await db.user.findFirstOrThrow({ where: { role: "OWNER" } });
  const result = await generateBill(session.id, {}, owner);
  if (!result.ok) throw new Error(result.error);
  await applyRedemption(result.billId, 100, owner.id);
  await generateBill(session.id, {}, owner);

  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.locator("input[name=password]").fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const [locale, label] of [["en", "Includes rewards discount"], ["hi", "पुरस्कार की छूट शामिल है"]]) {
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://127.0.0.1:3001" }]);
    for (const [path, width] of [[`/t/${table.code}`, 360], [`/admin/bills/view/${result.billId}`, 360], [`/admin/bills/view/${result.billId}/print`, 302]] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      await expect(page.getByText("₹150.00", { exact: true }).last()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const surface = path.startsWith("/t/") ? "customer" : path.endsWith("/print") ? "print" : "staff";
      await page.screenshot({ path: `.impeccable/review/redemption-${info.project.name}-${locale}-${surface}.png`, fullPage: true });
    }
  }
});
