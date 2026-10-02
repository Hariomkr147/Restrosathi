import { test, expect } from "@playwright/test";

test("owner settings preserve drafts on failure and save overnight hours", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL("/admin/settings");
  const open = page.locator("#mon-0-open");
  const close = page.locator("#mon-0-close");
  await open.fill("18:00"); await close.fill("01:00");
  const monday = page.getByRole("group", { name: "Monday", exact: true });
  await monday.getByLabel("Closed", { exact: true }).check();
  await monday.getByLabel("Closed", { exact: true }).uncheck();
  await expect(open).toHaveValue("18:00"); await expect(close).toHaveValue("01:00");
  await monday.getByRole("button", { name: "Add second shift" }).click();
  await expect(page.locator("#mon-1-open")).toBeVisible();
  await monday.getByRole("button", { name: "Remove shift" }).click();
  await page.getByLabel("Phone number", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#error-phone")).toHaveText("Use +91 followed by 10 digits.");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900000");
  await page.route("**/admin/settings", async (route) => {
    if (route.request().method() === "POST") await route.abort(); else await route.continue();
  });
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save." })).toBeVisible();
  await expect(open).toHaveValue("18:00");
  await page.unroute("**/admin/settings");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Save settings" }).focus();
  expect(await page.getByRole("button", { name: "Save settings" }).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(open).toHaveValue("18:00"); await expect(close).toHaveValue("01:00");
  // Restore the fixture for other public-page checks.
  await open.fill("11:00"); await close.fill("23:00");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/settings-desktop.png", fullPage: true });
  }
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByLabel("हिन्दी में विवरण (वैकल्पिक)").fill("स्वादिष्ट व्यंजनों और परिवार के साथ भोजन के लिए काल्पनिक रेस्तराँ का विवरण ".repeat(20));
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const control of await page.locator("button, input:not([type=checkbox]), textarea, nav a").all()) {
    const bounds = await control.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/settings-mobile.png", fullPage: true });
  }
});
