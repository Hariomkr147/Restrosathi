import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Booking Confirm E2E", () => {
  test.beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    await prisma.booking.deleteMany();
  });

  test("Owner can confirm a booking, and customer can cancel it via token", async ({ page }) => {
    const b = await prisma.booking.create({
      data: {
        name: "Test Person", phone: "919999999999", partySize: 4,
        slotStart: new Date("2026-10-10T14:30:00.000Z"),
        status: "REQUESTED", cancelToken: "E2E_CANCEL_TOKEN"
      }
    });

    await page.goto("/login");
    await page.getByLabel("Phone number").fill("+919999900001");
    await page.getByLabel("Password").fill(process.env.SEED_OWNER_PASSWORD || "owner_password");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/.*\/admin/);

    // 3. Go to Bookings
    await page.goto("/admin/bookings");

    // 4. Confirm the booking
    await page.getByRole("button", { name: "Confirm" }).click();
    
    // Verify it moved to confirmed
    await expect(page.getByText("Confirmed (1)")).toBeVisible();

    // 5. Go to customer cancel link
    await page.goto("/book/cancel/E2E_CANCEL_TOKEN");
    
    // 6. Cancel it
    await expect(page.getByText("Test Person")).toBeVisible();
    await page.getByRole("button", { name: "Yes, cancel it" }).click();
    
    // Verify it is cancelled
    await expect(page.getByText("This booking has been cancelled.")).toBeVisible();
  });
});
