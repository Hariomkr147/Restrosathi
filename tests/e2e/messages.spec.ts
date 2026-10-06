import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/db";

test.describe("Messages", () => {
  test.beforeEach(async () => {
    await prisma.messageLog.deleteMany({});
    await prisma.threadState.deleteMany({});
  });

  test("admin can see messages and mark as handled", async ({ page }) => {
    // Insert a needsHuman message
    await prisma.messageLog.create({
      data: {
        direction: "IN",
        phone: "+911122334455",
        status: "RECEIVED",
        body: "Hello, I need help with something.",
        externalId: "ext123",
        needsHuman: true,
      }
    });

    await page.goto("/login");
    await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
    await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD || "owner");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/admin");

    await page.goto("/admin/messages");
    
    // Check if the message is there
    await expect(page.locator("text=+911122334455")).toBeVisible();
    await expect(page.locator("text=Needs Human")).toBeVisible();
    await expect(page.locator("text=Hello, I need help with something.")).toBeVisible();

    // Click Mark Handled
    await page.click("button:has-text('Mark Handled')");

    // The Needs Human badge should be gone
    await expect(page.locator("text=Needs Human")).toBeHidden();

    // And the thread state should have aiPausedUntil set
    const thread = await prisma.threadState.findUnique({ where: { phone: "+911122334455" } });
    expect(thread?.aiPausedUntil).not.toBeNull();
  });
});
