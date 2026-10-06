import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test.describe.configure({ mode: 'serial' });
test.describe("WhatsApp Banner", () => {
  const controlFile = path.resolve("test-results/fake-wa-control.txt");

  test.beforeEach(async ({ page }) => {
    // ensure clear state
    await fs.rm(controlFile, { force: true });
    await page.goto("/login");
    await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
    await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("/admin");
  });

  test.afterAll(async () => {
    await fs.rm(controlFile, { force: true });
  });

  test("shows banner when disconnected, hides when connected", async ({ page }) => {
    test.setTimeout(60000); // Allow time for cache to expire

    // 1. default is connected
    await page.goto("/admin/board");
    await expect(page.locator("#wa-banner")).not.toBeVisible();

    // 2. disconnected
    await fs.writeFile(controlFile, "disconnected", "utf8");
    // wait for health cache (30s) to expire
    await page.waitForTimeout(31000);
    
    await page.reload();
    const banner = page.locator("#wa-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("WhatsApp is not connected");
  });
});
