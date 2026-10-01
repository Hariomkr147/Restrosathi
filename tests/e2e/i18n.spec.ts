import { test, expect } from "@playwright/test";

test("language toggle switches to Hindi and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("unknown locale falls back to English and the toggle works with a keyboard", async ({ page, context }, testInfo) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "unknown", domain: "localhost", path: "/" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const button = page.getByRole("button", { name: /हिन्दी|Hindi/ });
  const size = await button.boundingBox();
  expect(size?.width).toBeGreaterThanOrEqual(44);
  expect(size?.height).toBeGreaterThanOrEqual(44);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    if (await button.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(button).toBeFocused();
  expect(await button.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.screenshot({ path: testInfo.outputPath("i18n.png"), fullPage: true });
  await page.locator("h1").evaluate((heading) => { heading.textContent = "आज के लिए खास ताज़ा मसालों से तैयार स्वादिष्ट भारतीय व्यंजन"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("language failure is announced and allows retry", async ({ page }) => {
  await page.goto("/");
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") await route.abort();
    else await route.continue();
  });
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not change language. Try again." })).toHaveText("Could not change language. Try again.");
  await expect(page.getByRole("button", { name: /हिन्दी|Hindi/ })).toBeEnabled();
  await page.unroute("**/*");
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
});
