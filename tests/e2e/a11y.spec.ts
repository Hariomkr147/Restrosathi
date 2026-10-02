import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

for (const locale of ["en", "hi"] as const) {
  for (const path of ["/", "/menu", "/login", "/login/staff", "/admin", "/admin/settings", "/admin/menu", "/admin/menu/dal-makhani", "/admin/menu/new"]) {
    test(`${locale} ${path} has no serious accessibility violations`, async ({ page, context, baseURL }) => {
      if (path.startsWith("/admin")) {
        await page.goto("/login");
        await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
        await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
        await page.getByRole("button", { name: "Log in", exact: true }).click();
        await expect(page).toHaveURL("/admin");
      }
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL! }]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}
