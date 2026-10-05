import { test, expect } from "@playwright/test";
import { resetOperationalData, db, TABLE_CODES } from "../helpers/db";

test.beforeEach(async () => {
  await resetOperationalData();
});

test("exit scenario: dine-in and takeaway billing cycle", async ({ page, context, isMobile }) => {
  test.setTimeout(60000);
  if (page.viewportSize()?.width && page.viewportSize()!.width < 768) {
    test.skip();
  }
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => console.log('FAILED REQUEST:', request.url(), request.failure()?.errorText));
  page.on('response', response => {
    if (response.status() >= 400) console.log('ERROR RESPONSE:', response.status(), response.url());
  });
  
  // Setup: Owner logs in as staff
  await page.goto("/login/staff");
  await expect(async () => {
    await page.locator("#staff-pin").fill(process.env.SEED_STAFF_PIN!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/admin");
  }).toPass({ timeout: 30000 });
  await page.goto("/admin/board");
  await page.getByRole("button", { name: "Start shift" }).click();

  // (a) Dine-in: customer orders, staff accepts, serves, generates a bill, settles, prints
  const customer = await context.newPage();
  await customer.goto(`/t/${TABLE_CODES[0]}`);
  
  // Customer adds item and places order
  await customer.getByTestId("dish-Samosa").getByRole("button", { name: "Add", exact: true }).click();
  await customer.getByRole("dialog").getByRole("button", { name: "Add to cart", exact: true }).click();
  await customer.getByRole("button", { name: "View cart (1)" }).click();
  await customer.getByRole("button", { name: "Place order" }).click();
  
  // Customer sees progress
  await expect(customer.getByRole("heading", { name: "Received", exact: true })).toBeVisible();

  // Staff side
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "board.png", fullPage: true });
  await expect(page.locator(".border", { hasText: "Samosa" }).first()).toBeVisible({ timeout: 15000 });
  
  // Staff accepts
  await page.locator(".border button:text-is('Accept')").first().click();
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Preparing (1)" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Preparing (1)" }).click({ force: true });
  }
  await expect(page.locator(".border button:text-is('Ready')").first()).toBeVisible({ timeout: 10000 });
  
  // Staff marks ready
  await page.locator(".border button:text-is('Ready')").first().click();
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Served (1)" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Served (1)" }).click({ force: true });
  }
  await expect(page.locator(".border button:text-is('Served')").first()).toBeVisible();

  // Staff serves
  await page.locator(".border button:text-is('Served')").first().click();
  await expect(page.locator(".border button:text-is('Served')").first()).not.toBeVisible();
  
  // Navigate to bills page to generate bill
  await page.goto("/admin/bills");
  await page.getByRole("link", { name: "Table T1" }).click();
  await page.getByRole("button", { name: /Generate [bB]ill/i }).click();
  
  // Customer sees bill snapshot and Thank you for visiting after settlement
  await expect(customer.getByText("Samosa").first()).toBeVisible();
  await expect(customer.getByText("Subtotal").first()).toBeVisible();

  // Staff settles with split payment
  await page.getByRole("link", { name: "Settle" }).click();
  // SettleSheet opens
  await page.getByLabel("Split payment").check();
  
  // Add first row (Cash, 50.00)
  const amountInput = page.getByRole("spinbutton", { name: "Amount" }).first();
  await amountInput.fill("50.00");
  
  // Add second row
  await page.getByRole("button", { name: "Add payment method" }).click();
  const methodSelect2 = page.getByLabel("Payment method").nth(1);
  await methodSelect2.selectOption("UPI");
  const amountInput2 = page.getByRole("spinbutton", { name: "Amount" }).nth(1);
  await amountInput2.fill("30.00"); // 50 + 30 = 80 total
  
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Invoice").first()).toBeVisible();
  
  // Customer sees Thank you
  await expect(customer.getByText("Thank you for visiting!")).toBeVisible();
  
  // Print page loads
  const printPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Print", exact: true }).click();
  const printPage = await printPromise;
  await expect(printPage.getByText("Samosa")).toBeVisible();
  await printPage.close();
  

  
  // A new scan opens a new session
  await customer.goto(`/t/${TABLE_CODES[0]}`);
  await expect(customer.getByText("Thank you for visiting!")).not.toBeVisible();
  await expect(customer.getByRole("button", { name: "Add" }).first()).toBeVisible();
  await customer.close();

  // (b) Takeaway: staff creates a takeaway order, bills and settles it
  await page.goto("/admin/orders/new");
  await page.getByRole("radio", { name: "Takeaway" }).check();
  await page.getByTestId("dish-Samosa").getByRole("button").click();
  await page.getByRole("dialog").getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: /Review/i }).click(); // The cart button says "Review (1)"
  await page.getByRole("button", { name: "Place order" }).click();
  
  // Wait for redirect to board
  await expect(page).toHaveURL("/admin/board");

  // Generate bill for takeaway
  await page.goto("/admin/bills");
  await page.getByRole("link", { name: "Takeaway" }).first().click();
  await page.getByRole("button", { name: /Generate [bB]ill/i }).click();
  
  // Note the URL to simulate concurrent settlement
  await page.getByRole("link", { name: "Settle" }).click();
  await expect(page).toHaveURL(/.*\/settle/);
  const settleUrl = page.url();
  
  // (d) two staff contexts settle the same bill at once → one settlement
  const staff2 = await context.newPage();
  await staff2.goto(settleUrl);
  
  const p1 = page.getByRole("button", { name: /CASH/i }).click();
  const p2 = staff2.getByRole("button", { name: /UPI/i }).click();
  
  await Promise.all([p1, p2]);
  
  // One should succeed, one should fail with an error message
  await page.waitForTimeout(2000);
  const err1 = await page.locator(".text-destructive").count();
  const err2 = await staff2.locator(".text-destructive").count();
  
  expect(err1 + err2).toBeGreaterThan(0);

  // Close staff2
  await staff2.close();

  // (c) day-end total equals the sum of the two bills (80 + 80 = 160)
  // Need OWNER access for day-end report
  await page.goto("/admin/board"); // navigate somewhere
  await page.getByRole("button", { name: "Log out" }).click();
  
  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  
  await page.goto("/admin/reports/day-end");
  await expect(page.getByText("₹160.00").first()).toBeVisible();
});
