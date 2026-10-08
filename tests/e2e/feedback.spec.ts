import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/db";
import { upsertCustomer } from "../../src/lib/customers/index";
import crypto from "crypto";

test.describe("Feedback", () => {
  let customerId: string;
  let billId: string;
  let validToken: string;
  let expiredToken: string;

  test.beforeAll(async () => {
    // Need a dummy bill and customer for feedback
    const c = await upsertCustomer("9999944444", { name: "Feedback Tester" });
    customerId = c.id;
    
    const session = await prisma.diningSession.create({
      data: { kind: "TAKEAWAY", customerName: "Feedback Tester", customerPhone: c.phone }
    });
    
    const bill = await prisma.bill.create({
      data: {
        sessionId: session.id,
        status: "SETTLED",
        number: "INV-FB-1",
        subtotalPaise: 1000,
        taxableValuePaise: 1000,
        cgstPaise: 0,
        sgstPaise: 0,
        discountPaise: 0,
        roundOffPaise: 0,
        totalPaise: 1000,
        customerName: c.name,
        customerPhone: c.phone,
        generatedAt: new Date(),
        settledAt: new Date(),
        docType: "BILL",
        taxMode: "NONE",
        gstRatePercent: 0,
        pricesIncludeTax: false,
        header: {},
        generatedById: "user1"
      }
    });
    billId = bill.id;
  });

  test.beforeEach(async () => {
    await prisma.feedback.deleteMany();
    
    validToken = crypto.randomBytes(16).toString("hex");
    await prisma.feedback.create({
      data: {
        billId,
        customerId,
        token: validToken,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    expiredToken = crypto.randomBytes(16).toString("hex");
    await prisma.feedback.create({
      data: {
        billId,
        customerId,
        token: expiredToken,
        tokenExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      }
    });
  });

  test("submits feedback successfully and prevents double submit", async ({ page }) => {
    await page.goto(`/feedback/${validToken}`);
    await expect(page.locator("text=We value your feedback")).toBeVisible();
    
    // Select 5 stars
    await page.locator("text=5 - Excellent").click();
    await page.locator("textarea").fill("Great food!");
    await page.locator("button:has-text('Submit Feedback')").click();
    
    await expect(page.locator("text=Thank you!")).toBeVisible();
    await expect(page.locator("text=Your feedback has been submitted successfully.")).toBeVisible();
    
    // Refresh to check double submit prevention UI
    await page.reload();
    await expect(page.locator("text=Thanks, we already have your feedback")).toBeVisible();
    
    // Verify DB
    const fb = await prisma.feedback.findUnique({ where: { token: validToken } });
    expect(fb?.rating).toBe(5);
    expect(fb?.comment).toBe("Great food!");
  });

  test("expired token shows error and google link but no personal data", async ({ page }) => {
    // Add dummy google url
    await prisma.settings.update({
      where: { id: 1 },
      data: { googleReviewUrl: "https://g.page/dummy" }
    });
    
    await page.goto(`/feedback/${expiredToken}`);
    await expect(page.locator("text=This feedback link has expired")).toBeVisible();
    await expect(page.locator("text=Review us on Google instead")).toBeVisible();
    
    // Should NOT see any customer details on the page
    await expect(page.locator("text=Feedback Tester")).not.toBeVisible();
    await expect(page.locator("text=9999944444")).not.toBeVisible();
    await expect(page.locator("text=INV-FB-1")).not.toBeVisible();
  });
});
