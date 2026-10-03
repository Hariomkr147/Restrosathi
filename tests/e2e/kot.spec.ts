import { test, expect } from "@playwright/test";
import { resetOperationalData, createOrderableItem, TABLE_CODES, db } from "../helpers/db";

test.beforeAll(async () => {
  await createOrderableItem();
});
test.beforeEach(async () => {
  await resetOperationalData();
});

test("KOT print page shows table, lines, hides nav in print media", async ({ page, context }) => {
  // Setup: Customer places order
  const customerContext = await context.browser()!.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto(`/t/${TABLE_CODES[0]}`);
  await customerPage.getByTestId("dish-Demo platter").getByRole("button", { name: "Add", exact: true }).click();
  const sheet = customerPage.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Full/ }).check();
  await sheet.getByRole("checkbox", { name: /Cheese/ }).check();
  await sheet.getByRole("button", { name: "Add to cart", exact: true }).click();
  await customerPage.getByRole("button", { name: /View cart/ }).click();
  const cart = customerPage.getByRole("dialog");
  await cart.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(customerPage.getByText("Received", { exact: true })).toBeVisible({ timeout: 10000 });
  
  // Find order ID
  const order = await db.order.findFirst({
    where: { status: "NEW" },
    orderBy: { placedAt: "desc" }
  });
  expect(order).not.toBeNull();

  // Anonymous user redirected to login
  await page.goto(`/admin/orders/${order!.id}/kot`);
  await expect(page).toHaveURL(/.*\/login/);

  // Staff logs in
  await page.goto("/login/staff");
  await page.getByLabel("Staff member").selectOption({ label: "Ravi" });
  await page.fill("input[name=pin]", process.env.SEED_STAFF_PIN!);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/.*\/admin/);

  // View KOT
  await page.goto(`/admin/orders/${order!.id}/kot`);
  
  // Table label T1
  await expect(page.locator("text=Table: T1")).toBeVisible();
  
  // Order items
  await expect(page.locator("text=1x")).toBeVisible();
  await expect(page.locator("text=Demo platter")).toBeVisible();
  await expect(page.locator("text=Full")).toBeVisible();
  await expect(page.locator("text=CHEESE")).toBeVisible();

  // The page content width should fit 80mm ≈ 302px (with some margin)
  // Let's check there's no horizontal overflow by checking layout width
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  // In print media, nav should be hidden (we emulate print)
  await page.emulateMedia({ media: "print" });
  // Ensure the main Next.js layout nav doesn't show
  // (Assuming layout hides top nav in print)
  const navVisible = await page.locator("nav").isVisible();
  expect(navVisible).toBe(false);
});
