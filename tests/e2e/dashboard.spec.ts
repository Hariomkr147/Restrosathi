import { test, expect } from "@playwright/test";

test.describe("Dashboard Access", () => {
  test.use({ storageState: "tests/fixtures/auth-owner.json" });

  test("owner sees financial dashboard facts", async ({ page }) => {
    await page.goto("/admin");
    
    // Check for owner elements
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByText("Today's Sales")).toBeVisible();
    await expect(page.getByText("30-Day Sales")).toBeVisible();
    await expect(page.getByText("7-Day Feedback Avg")).toBeVisible();
    await expect(page.getByText("Needs Human Attention")).toBeVisible();
    
    // Check that there is an accessible table for 30-day sales
    const table = page.locator('table caption:has-text("30-Day Sales Data")');
    await expect(table).toBeAttached();
  });
});

test.describe("Dashboard Access - Staff", () => {
  test.use({ storageState: "tests/fixtures/auth-staff.json" });

  test("staff sees only operational shortcuts", async ({ page }) => {
    await page.goto("/admin");
    
    // Check for staff elements
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByText("Kitchen Board")).toBeVisible();
    await expect(page.getByText("Tables")).toBeVisible();
    
    // Check that owner elements are hidden
    await expect(page.getByText("Today's Sales")).not.toBeVisible();
    await expect(page.getByText("30-Day Sales")).not.toBeVisible();
    await expect(page.getByText("7-Day Feedback Avg")).not.toBeVisible();
  });
});
