import { test, expect } from "@playwright/test";

test("menu shows prices, filters veg, shows sold out", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop") await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/menu");
  await expect(page.getByText("Dal Makhani", { exact: true })).toBeVisible();
  await expect(page.getByText("₹180.00", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add$/ })).toHaveCount(0);
  for (const control of await page.locator("nav a, nav button").all()) {
    const bounds = await control.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "desktop") {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/desktop.png", fullPage: true });
  }
  const veg = page.getByRole("switch", { name: /vegetarian/i });
  const size = await veg.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(44);
  expect(size!.height).toBeGreaterThanOrEqual(44);
  await veg.click();
  await expect(veg).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Butter Chicken", { exact: true })).toHaveCount(0);
  await veg.click();
  await expect(page.getByTestId("dish-Mutton Rogan Josh").getByText("Sold out today")).toBeVisible();
});

test("Hindi names with English fallback, no horizontal scroll at 360px", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "hi", url: "http://localhost:3000" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/menu");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByText("दाल मखनी", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dish-Kulfi").getByRole("heading", { name: "Kulfi" })).toBeVisible();
  await expect(page.getByTestId("dish-Vegetable Biryani").getByRole("heading")).toHaveText("ताज़ी सब्ज़ियों और सुगंधित मसालों से बनी विशेष दम बिरयानी");
  await expect(page.getByTestId(/dish-/).filter({ hasText: "undefined" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/mobile.png", fullPage: true });
  }
});

test("search works in both languages and categories work with a keyboard", async ({ page }) => {
  await page.goto("/menu");
  const search = page.getByRole("searchbox", { name: "Search dishes" });
  await search.fill("  NAAN ");
  await expect(page.getByTestId("dish-Butter Naan")).toBeVisible();
  await expect(page.getByTestId("dish-Dal Makhani")).toHaveCount(0);
  await search.fill("दाल");
  await expect(page.getByTestId("dish-Dal Makhani")).toBeVisible();
  await search.fill("zz-no-dish");
  await expect(page.getByRole("status")).toHaveText("No dishes found. Try another search.");
  await search.fill("");
  const breads = page.getByRole("link", { name: "Breads", exact: true });
  await breads.focus();
  expect(await breads.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(breads).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#category-breads$/);
  await expect(page.getByTestId("dish-Butter Naan")).toBeVisible();
});
