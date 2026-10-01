import { statSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("home shows the restaurant, menu CTA, safe SEO and contact links", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop") await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saffron Tadka");
  await expect(page.getByRole("link", { name: "Book a table" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Plan an event" })).toHaveCount(0);
  const json = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}");
  expect(json.name).toBe("Saffron Tadka");
  expect(json["@type"]).toBe("Restaurant");
  await expect(page.getByRole("link", { name: "Chat on WhatsApp", exact: true })).toHaveAttribute("href", /^https:\/\/wa\.me\/91/);
  await expect(page.getByRole("link", { name: "Call", exact: true })).toHaveAttribute("href", /^tel:\+91/);
  await expect(page.getByTestId(/dish-/)).toHaveCount(3);
  expect(statSync("public/brand/hero.webp").size).toBeLessThanOrEqual(200 * 1024);
  for (const control of await page.locator("nav a, nav button, aside a, main a").all()) {
    const bounds = await control.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "desktop") {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/home-desktop.png", fullPage: true });
  }
  const menuLink = page.getByRole("link", { name: "View menu", exact: true });
  await menuLink.focus();
  expect(await menuLink.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/menu$/);
});

test("Hindi home works at 360px with reduced motion", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "hi", url: "http://localhost:3000" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saffron Tadka");
  await expect(page.getByRole("link", { name: "व्यंजन सूची देखें", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el.parentElement!.parentElement!).transform)).toBe("none");
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: ".impeccable/review/home-mobile.png", fullPage: true });
  }
  await page.getByRole("heading", { level: 1 }).evaluate((el) => { el.textContent = "रेस्तराँ का एक बहुत लंबा उदाहरण नाम ".repeat(6); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
