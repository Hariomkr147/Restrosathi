/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe.configure({ mode: "serial" });

test.describe("Book request E2E", () => {
  test.beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.messageLog.deleteMany();
  });

  test("loads page, asks for OTP, succeeds", async ({ page, context }) => {
    // Clear cookies to ensure unverified phone
    await context.clearCookies();

    await page.goto("/book");
    await expect(page.locator("h1")).toHaveText("Book a Table");

    // Fill form
    await page.fill('input[type="text"]', "E2E Test Guest");
    await page.fill('input[type="tel"]', "+919999911111");

    // Pick tomorrow's date
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const dateStr = tmr.toISOString().slice(0, 10);
    await page.fill('input[type="date"]', dateStr);

    // Wait for slots to load
    try {
      await page.waitForSelector('[data-testid="slot-button"]', { timeout: 5000 });
    } catch (e) {
      console.log("HTML at timeout:", await page.content());
      throw e;
    }
    // Click the first available slot button
    await page.locator('[data-testid="slot-button"]').nth(0).click();

    // Submit
    await page.click('button[type="submit"]');

    // Should prompt for OTP
    await expect(page.getByRole("heading", { name: "Verify Phone" })).toBeVisible({ timeout: 5000 });
    
    // Check DB for OTP
    const otpRow = await prisma.otpCode.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    
    // We cannot easily get the plaintext code since DB stores hash.
    // In our test environment, we might want to stub or check outbox.
    // Wait, the outbox contains the plaintext!
    const outboxRow = await prisma.messageLog.findFirstOrThrow({ 
      where: { kind: "OTP" },
      orderBy: { createdAt: "desc" } 
    });
    console.log("OUTBOX PARAMS:", outboxRow.params);
    const code = (outboxRow.params as any).code || (outboxRow.params as any).otp;
    
    // Fill OTP
    await page.fill('input[type="text"]', code || "123456");
    await page.click('button[type="submit"]');

    // Success screen
    await expect(page.getByRole("heading", { name: "Request Received!" })).toBeVisible({ timeout: 5000 });
    
    // Check DB for booking
    const booking = await prisma.booking.findFirstOrThrow();
    expect(booking.name).toBe("E2E Test Guest");
    expect(booking.phone).toBe("+919999911111");
    expect(booking.status).toBe("REQUESTED");
  });
});
