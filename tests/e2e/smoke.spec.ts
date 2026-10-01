import { test, expect } from "@playwright/test";

test("home renders with brand tokens", async ({ page }) => {
  await page.goto("/");
  const surface = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim(),
  );
  expect(surface).not.toBe("");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("foundation stays readable, responsive and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return Object.fromEntries([
      "--color-text", "--color-text-muted", "--color-surface", "--color-surface-raised",
      "--color-primary", "--color-primary-contrast", "--color-focus",
      "--duration-fast", "--duration-base",
    ].map((key) => [key, root.getPropertyValue(key).trim()]));
  });
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const values = [luminance(tokens[a]), luminance(tokens[b])];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
  };
  for (const foreground of ["--color-text", "--color-text-muted"]) {
    for (const background of ["--color-surface", "--color-surface-raised"]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast("--color-primary", "--color-primary-contrast")).toBeGreaterThanOrEqual(4.5);
  expect(contrast("--color-focus", "--color-surface")).toBeGreaterThanOrEqual(3);
  expect(tokens["--duration-fast"]).toMatch(/^0(?:ms|s)$/);
  expect(tokens["--duration-base"]).toMatch(/^0(?:ms|s)$/);
  await page.locator("h1").evaluate((heading) => {
    document.documentElement.lang = "hi";
    heading.textContent = "आज के लिए खास ताज़ा मसालों से तैयार स्वादिष्ट भारतीय व्यंजन";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
