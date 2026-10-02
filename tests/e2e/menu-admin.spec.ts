import { test, expect } from "@playwright/test";

test("staff marks a dish sold out and restores it on the public menu", async ({ page, context }, testInfo) => {
  await page.goto("/login/staff");
  await page.getByLabel("Staff member", { exact: true }).selectOption({ label: "Ravi" });
  await page.getByLabel("4–6 digit PIN", { exact: true }).fill(process.env.SEED_STAFF_PIN!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.getByRole("link", { name: "Menu editor", exact: true }).click();
  await expect(page.getByRole("link", { name: "Add item", exact: true })).toHaveCount(0);
  const toggle = page.getByRole("switch", { name: "Sold out: Paneer Tikka", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const publicPage = await context.newPage();
  await publicPage.goto("/menu");
  await expect(publicPage.getByTestId("dish-Paneer Tikka").getByText("Sold out today")).toBeVisible();
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-checked", "false");
  await publicPage.reload();
  await expect(publicPage.getByTestId("dish-Paneer Tikka").getByText("Sold out today")).toHaveCount(0);
  await publicPage.close();
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/menu-admin-desktop.png", fullPage: true });
  }
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.setViewportSize({ width: 360, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: ".impeccable/review/menu-admin-mobile.png", fullPage: true });
  }
  await page.goto("/admin/menu/butter-naan"); await expect(page).toHaveURL("/login");
});

test("owner edits portions/options and uploads a validated photo", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/menu/butter-naan");
  await expect(page.locator("#base-price")).toHaveValue("60.00");
  await expect(page.locator("#option-price-0-0")).toHaveValue("10.00");
  await page.locator("#base-price").fill("70.29");
  await page.locator("#photo").setInputFiles("src/lib/menu/__fixtures__/fake.jpg");
  await expect(page.getByRole("alert").filter({ hasText: "Choose a valid" })).toBeVisible();
  await page.locator("#photo").setInputFiles("src/lib/menu/__fixtures__/tiny.png");
  await expect(page.getByRole("img", { name: "Butter Naan", exact: true })).toBeVisible();
  await page.route("**/admin/menu/butter-naan", (route) => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save." })).toBeVisible();
  await expect(page.locator("#base-price")).toHaveValue("70.29");
  await expect(page.getByRole("img", { name: "Butter Naan", exact: true })).toBeVisible();
  await page.unroute("**/admin/menu/butter-naan");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page).toHaveURL("/admin/menu");
  await page.goto("/menu"); await expect(page.getByTestId("dish-Butter Naan").getByText("₹70.29", { exact: true })).toBeVisible();
  await page.goto("/admin/menu/butter-naan");
  await page.locator("#base-price").fill("60.00");
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page).toHaveURL("/admin/menu");
  await page.goto("/admin/menu/dal-makhani");
  await expect(page.getByLabel("Use named portions instead of one price")).toBeChecked();
  await expect(page.locator("#variant-price-0")).toHaveValue("180.00");
  await expect(page.locator("#variant-price-1")).toHaveValue("320.00");
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/item-editor-desktop.png", fullPage: true });
  }
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.setViewportSize({ width: 360, height: 740 });
  await page.locator("#dish-name-hi").fill("ताज़ी सब्ज़ियों और सुगंधित मसालों से बना विशेष व्यंजन ".repeat(8));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const control of await page.locator("button, input:not([type=checkbox]), select, textarea, nav a").all()) {
    const bounds = await control.boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: ".impeccable/review/item-editor-mobile.png", fullPage: true });
  }
});
