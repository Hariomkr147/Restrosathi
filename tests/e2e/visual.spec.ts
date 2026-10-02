import { test, expect } from "@playwright/test";

test("Hindi menu stays readable at 360px", async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "hi", url: baseURL! }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/menu");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByTestId("dish-Vegetable Biryani").getByRole("heading")).toHaveText("ताज़ी सब्ज़ियों और सुगंधित मसालों से बनी विशेष दम बिरयानी");
  await expect(page.getByTestId("dish-Kulfi").getByRole("heading")).toHaveText("Kulfi");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page).toHaveScreenshot("menu-hi-360.png", { fullPage: true });
});
