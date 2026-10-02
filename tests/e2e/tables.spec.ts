import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("owner manages a table, confirms regeneration and prints bilingual A4 QR cards", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.getByRole("link", { name: "Tables", exact: true }).click();
  const label = `QR ${testInfo.project.name}`;
  await page.getByLabel("New table label", { exact: true }).fill(label);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add table", exact: true })).toBeFocused();
  expect(await page.getByRole("button", { name: "Add table", exact: true }).evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.route("**/admin/tables", (route) => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await page.getByRole("button", { name: "Add table", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save" })).toBeFocused();
  await expect(page.getByLabel("New table label", { exact: true })).toHaveValue(label);
  await page.unroute("**/admin/tables");
  await page.getByRole("button", { name: "Add table", exact: true }).click();
  const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
  await expect(row).toBeVisible();
  const oldUrl = await row.getByRole("link", { name: "Open table link" }).getAttribute("href");
  await row.getByRole("button", { name: "Regenerate code", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("The printed QR will stop working");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  const dialogBounds = await page.getByRole("dialog").boundingBox();
  expect(Math.abs(dialogBounds!.x - (page.viewportSize()!.width - dialogBounds!.width) / 2)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `.impeccable/review/tables-dialog-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row.getByRole("button", { name: "Regenerate code", exact: true })).toBeFocused();
  await expect(row.getByRole("link", { name: "Open table link" })).toHaveAttribute("href", oldUrl!);
  await row.getByRole("button", { name: "Regenerate code", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Regenerate code", exact: true }).click();
  await expect(row.getByRole("link", { name: "Open table link" })).not.toHaveAttribute("href", oldUrl!);
  await row.getByRole("switch", { name: "Active" }).click();
  await expect(row.getByRole("switch", { name: "Active" })).toHaveAttribute("aria-checked", "false");
  await row.getByRole("switch", { name: "Active" }).click();
  await expect(row.getByRole("switch", { name: "Active" })).toHaveAttribute("aria-checked", "true");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/tables-desktop.png", fullPage: true });
  }
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.setViewportSize({ width: 360, height: 740 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await row.getByLabel("मेज़ का नाम", { exact: true }).fill("विशेष पारिवारिक मेज़");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page.locator("button, input, nav a").all()) {
    if (!await control.isVisible()) continue;
    const bounds = await control.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: ".impeccable/review/tables-mobile.png", fullPage: true });
  }
  await page.goto("/admin/tables/print");
  const card = page.getByRole("article").filter({ hasText: label });
  await expect(card).toContainText("Saffron Tadka"); await expect(card.locator("svg")).toHaveCount(1);
  await expect(card).toContainText("मेन्यू देखें और ऑर्डर करने के लिए स्कैन करें");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 794, height: 1123 }); await page.emulateMedia({ media: "print" });
  await expect(page.locator("nav")).toBeHidden();
  expect(await page.locator(".qr-sheet").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  await page.evaluate(() => document.fonts.ready);
  const printTops = await page.locator(".qr-card").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  for (let index = 0; index + 1 < printTops.length; index += 2) expect(printTops[index]).toBe(printTops[index + 1]);
  await page.screenshot({ path: `.impeccable/review/tables-print-${testInfo.project.name}.png`, fullPage: true });
});
test("staff can print QR codes and cannot reach owner table editing", async ({ page }) => {
  await page.goto("/login/staff");
  await page.getByLabel("Staff member", { exact: true }).selectOption({ label: "Ravi" });
  await page.getByLabel("4–6 digit PIN", { exact: true }).fill(process.env.SEED_STAFF_PIN!);
  await page.getByRole("button", { name: "Log in", exact: true }).click(); await expect(page).toHaveURL("/admin");
  await page.getByRole("link", { name: "Print table QR codes", exact: true }).click();
  await expect(page.locator("article svg").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Add table|Rename|Regenerate code/ })).toHaveCount(0);
  await page.setViewportSize({ width: 794, height: 1123 }); await page.emulateMedia({ media: "print" });
  const printTops = await page.locator(".qr-card").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  for (let index = 0; index + 1 < printTops.length; index += 2) expect(printTops[index]).toBe(printTops[index + 1]);
  await page.emulateMedia({ media: "screen" });
  await page.goto("/admin/tables"); await expect(page).toHaveURL("/login");
});
