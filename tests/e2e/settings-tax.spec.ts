import { test, expect } from "@playwright/test";

test.describe("Settings: Tax", () => {
  test.use({ storageState: "playwright/.auth/owner.json" });

  test("owner sets REGULAR + test GSTIN + 5% in /admin/settings, reloads, sees the saved values", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /Settings|सेटिंग्स/ })).toBeVisible();

    await page.getByLabel(/Tax Mode|कर मोड/i).selectOption("REGULAR");
    await page.getByLabel(/GST Rate|जीएसटी दर/i).fill("5");
    await page.getByLabel("GSTIN").fill("27AAAAA0000A1Z5");
    await page.getByRole("button", { name: /Save|सहेजें/ }).click();
    await expect(page.getByText(/Saved|सहेजा गया/)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(/Tax Mode|कर मोड/i)).toHaveValue("REGULAR");
    await expect(page.getByLabel(/GST Rate|जीएसटी दर/i)).toHaveValue("5");
    await expect(page.getByLabel("GSTIN")).toHaveValue("27AAAAA0000A1Z5");
  });

  test("saving REGULAR without GSTIN shows an inline error", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/Tax Mode|कर मोड/i).selectOption("REGULAR");
    await page.getByLabel("GSTIN").fill("");
    await page.getByRole("button", { name: /Save|सहेजें/ }).click();
    
    await expect(page.getByText(/GSTIN is required for REGULAR tax mode|REGULAR कर मोड के लिए GSTIN आवश्यक है/)).toBeVisible();
  });
});
