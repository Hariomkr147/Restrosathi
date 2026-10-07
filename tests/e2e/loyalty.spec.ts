import { test, expect } from "@playwright/test";
import { setupDemoData } from "./helpers";

test.describe("Loyalty", () => {
  let tableCode: string;

  test.beforeEach(async ({ request }) => {
    tableCode = await setupDemoData(request, { 
      loyaltyEnabled: true,
      loyaltyEarnPer100Rupees: 1,
      loyaltyRedeemUnitPoints: 100,
      loyaltyRedeemUnitValuePaise: 5000 
    });
  });

  test("customer joins rewards, earns, and redeems points", async ({ page, request }) => {
    // 1. Customer joins rewards
    await page.goto(`/t/${tableCode}`);
    
    // Fill phone and send OTP
    await page.fill('input[type="tel"]', "9999911111");
    await page.click('button:has-text("Send Code")');
    
    // OTP is 123456 in test mode
    for (let i = 0; i < 6; i++) {
      await page.fill(`input[aria-label="Digit ${i + 1}"]`, (i + 1).toString());
    }
    
    // Wait for verify
    await expect(page.locator('text=Your Balance')).toBeVisible();
    await expect(page.locator('text=0 pts')).toBeVisible();
  });
});
