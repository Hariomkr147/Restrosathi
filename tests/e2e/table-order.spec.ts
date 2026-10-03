import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db, TABLE_CODES, resetOperationalData, markSoldOut, createLongHindiItem, createOrderableItem } from "../helpers/db";

test.beforeEach(async () => { await resetOperationalData(); });
test.afterAll(async () => {
  await resetOperationalData(); await db.menuItem.deleteMany({ where: { id: { in: ["e2e-orderable-item", "e2e-long-hindi"] } } }); await db.$disconnect();
});
test("choose portions and extras, submit once, track and request help without payment", async ({ page }, info) => {
  await createOrderableItem(); await page.goto(`/t/${TABLE_CODES[0]}`);
  await expect(page.getByRole("heading", { name: "Table T1", exact: true })).toBeVisible();
  await page.getByTestId("dish-Demo platter").getByRole("button", { name: "Add", exact: true }).click();
  const item = page.getByRole("dialog", { name: "Demo platter", exact: true });
  await expect(item.getByRole("heading", { name: "Goes well with", exact: true })).toBeVisible();
  await expect(item.getByRole("button", { name: "Add to cart", exact: true })).toBeDisabled();
  await item.getByRole("radio", { name: /Full/ }).check();
  await item.getByRole("checkbox", { name: /Cheese/ }).check();
  await item.getByLabel("Note for the kitchen", { exact: true }).fill("Less salt");
  await item.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: /View cart/ }).click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(cart.getByTestId("cart-total")).toContainText("₹280.00");
  await cart.getByLabel("Your name (optional)", { exact: true }).fill("Guest");
  await cart.getByRole("button", { name: "Place order", exact: true }).dblclick();
  await expect(page.getByText("Received", { exact: true })).toBeVisible();
  expect(await db.order.count()).toBe(1);
  expect(await db.orderLine.findFirstOrThrow()).toMatchObject({ unitPricePaise: 28000, note: "Less salt" });
  await page.getByRole("button", { name: "Call waiter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Waiter requested", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Request bill", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bill requested", exact: true })).toBeDisabled();
  await expect(page.getByText("Amount so far", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /pay|payment/i })).toHaveCount(0);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.impeccable/review/table-order-${info.project.name}-en.png`, fullPage: true });
});
test("sold-out items stay view-only and Hindi long names fit with accessible controls", async ({ page }, info) => {
  const old = await db.menuItem.findUniqueOrThrow({ where: { id: "butter-chicken" } });
  await markSoldOut(old.id); await createLongHindiItem();
  try {
    await page.goto(`/t/${TABLE_CODES[0]}`);
    await expect(page.getByTestId("dish-Butter Chicken").getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.getByRole("heading", { name: "मेज़ T1", exact: true })).toBeVisible();
    await expect(page.getByTestId("dish-Long Hindi test dish").getByRole("heading")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.getByRole("button").all()) {
      const box = await button.boundingBox(); if (box) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    }
    const audit = await new AxeBuilder({ page }).analyze(); expect(audit.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `.impeccable/review/table-order-${info.project.name}-hi.png`, fullPage: true });
  } finally { await db.menuItem.update({ where: { id: old.id }, data: { available: old.available } }); }
});
test("a network failure preserves the cart and allows retry", async ({ page }) => {
  await page.goto(`/t/${TABLE_CODES[0]}`);
  await page.getByTestId("dish-Samosa").getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: /View cart/ }).click();
  await page.route(`**/t/${TABLE_CODES[0]}`, (route) => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not place" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Samosa", { exact: true })).toBeVisible();
  await page.unroute(`**/t/${TABLE_CODES[0]}`);
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.getByText("Received", { exact: true })).toBeVisible(); expect(await db.order.count()).toBe(1);
});
test("Fast4G displays menu within3s; initial encoded JS is within150KB", async ({ page }, info) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, latency: 150 });
  const scripts: Promise<{ url: string; bytes: number }>[] = [];
  page.on("response", (response) => { if (response.request().resourceType() === "script") scripts.push(response.request().sizes().then((size) => ({ url: response.url(), bytes: size.responseBodySize }))); });
  const start = Date.now(); const response = await page.goto(`/t/${TABLE_CODES[0]}`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200); await expect(page.getByRole("heading", { name: "Samosa", exact: true })).toBeVisible();
  expect(Date.now() - start).toBeLessThanOrEqual(3000);
  await page.waitForLoadState("networkidle"); const sizes = await Promise.all(scripts); expect(sizes.length).toBeGreaterThan(0);
  const total = sizes.reduce((sum, { bytes }) => sum + bytes, 0); console.log(`Table JavaScript: ${total} / 153600 bytes`);
  await info.attach("table-script-sizes", { body: JSON.stringify(sizes), contentType: "application/json" }); expect(total).toBeLessThanOrEqual(150 * 1024);
});
test("unknown table has a friendly404", async ({ page }) => {
  const response = await page.goto("/t/MISSING123"); expect(response?.status()).toBe(404);
  await expect(page.getByText("This table link isn't valid", { exact: true })).toBeVisible();
});
test("bilingual sheets support keyboard cancel, bounded quantities and empty-cart recovery", async ({ page, context }, info) => {
  await createOrderableItem();
  for (const locale of ["en", "hi"] as const) {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(`/t/${TABLE_CODES[0]}`);
    const hi = locale === "hi"; const add = page.getByTestId("dish-Demo platter").getByRole("button", { name: hi ? "जोड़ें" : "Add", exact: true });
    await add.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    expect(await add.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog"); const close = sheet.getByRole("button", { name: hi ? "बंद करें" : "Close", exact: true });
    await expect(close).toBeFocused(); await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0); await expect(add).toBeFocused(); await add.click();
    await sheet.getByRole("radio", { name: hi ? /पूरा/ : /Full/ }).check();
    await sheet.getByRole("checkbox", { name: hi ? /चीज़/ : /Cheese/ }).check();
    const qty = sheet.getByLabel(hi ? "संख्या" : "Quantity", { exact: true });
    await qty.fill("21"); await expect(sheet.getByRole("button", { name: hi ? "चुनी हुई सूची में जोड़ें" : "Add to cart", exact: true })).toBeDisabled();
    await qty.fill("20");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const a11y = await new AxeBuilder({ page }).analyze(); expect(a11y.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
    await page.screenshot({ path: `.impeccable/review/table-item-${info.project.name}-${locale}.png` });
    await sheet.getByRole("button", { name: hi ? "चुनी हुई सूची में जोड़ें" : "Add to cart", exact: true }).click();
    await page.getByRole("button", { name: hi ? /चुनी हुई सूची देखें/ : /View cart/ }).click();
    await page.screenshot({ path: `.impeccable/review/table-cart-${info.project.name}-${locale}.png` });
    await sheet.getByRole("button", { name: hi ? /हटाएँ प्रदर्शन थाली/ : /Remove Demo platter/ }).click();
    await expect(sheet.getByText(hi ? "आपकी सूची खाली है। मेन्यू से कोई व्यंजन जोड़ें।" : "Your cart is empty. Add a dish from the menu.", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: hi ? "बंद करें" : "Close", exact: true }).click();
    await expect(page.getByRole("heading", { name: hi ? "मेज़ T1" : "Table T1", exact: true })).toBeFocused();
  }
});
test("invalid quantity inputs (cleared or fractional) render safely without breaking the sheet", async ({ page }) => {
  await createOrderableItem();
  await page.goto(`/t/${TABLE_CODES[0]}`);
  await page.getByTestId("dish-Demo platter").getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Full/ }).check();
  await sheet.getByRole("checkbox", { name: /Cheese/ }).check();
  const qty = sheet.getByLabel("Quantity", { exact: true });
  await qty.fill(""); // Clear field, producing NaN
  await expect(sheet.getByRole("button", { name: "Add to cart", exact: true })).toBeDisabled();
  // The price should probably not show NaN
  await expect(sheet.getByText("NaN")).toHaveCount(0);
  
  await qty.fill("1.5"); // Fractional
  await expect(sheet.getByRole("button", { name: "Add to cart", exact: true })).toBeDisabled();
  await expect(sheet.getByText("NaN")).toHaveCount(0);
});
test("polling updates states, backs off failures and pauses while hidden", async ({ page }) => {
  const session = await db.diningSession.create({ data: { tableId: "table-1", kind: "DINE_IN", orders: { create: {
    idempotencyKey: crypto.randomUUID(), source: "QR", lines: { create: { nameSnapshot: { en: "Samosa", hi: "समोसा" }, modifiersSnapshot: [], qty: 1, unitPricePaise: 8000 } },
  } } }, include: { orders: true } });
  const order = session.orders[0]; await page.goto(`/t/${TABLE_CODES[0]}`);
  await page.getByRole("heading", { name: "Your orders", exact: true }).scrollIntoViewIfNeeded();
  await db.order.update({ where: { id: order.id }, data: { status: "PREPARING", acceptedAt: new Date() } });
  await expect(page.getByRole("heading", { name: "Preparing", exact: true })).toBeVisible({ timeout: 5000 });
  let calls = 0;
  await page.route("**/api/t/**/status", (route) => { calls++; return route.fulfill({ status: 503, body: "Unavailable" }); });
  await expect(page.getByText("Order updates are unavailable. We will try again shortly.", { exact: true })).toBeVisible({ timeout: 5000 });
  const failedCalls = calls; await page.waitForTimeout(3500); expect(calls).toBe(failedCalls);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(6500); expect(calls).toBe(failedCalls);
  
  // Test timeout specifically
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.route("**/api/t/**/status", async (route) => {
    // Deliberately hang the request
    await new Promise(resolve => setTimeout(resolve, 11000));
    return route.fulfill({ status: 200, json: { orders: [], openRequests: [] } });
  }, { times: 1 });
  // Should show error after 10s timeout
  await expect(page.getByText("Order updates are unavailable. We will try again shortly.", { exact: true })).toBeVisible({ timeout: 15000 });

  await db.order.update({ where: { id: order.id }, data: { status: "READY", readyAt: new Date() } });
  await page.unroute("**/api/t/**/status");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByRole("heading", { name: "Ready", exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Order updates are unavailable. We will try again shortly.", { exact: true })).toHaveCount(0);
});
