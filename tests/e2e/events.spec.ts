import { test, expect } from "@playwright/test";

test.describe("Events feature", () => {
  test("enquiry flow, quoting, and packages", async ({ page, context }) => {
    // 1. Owner adds a package
    await page.goto("/login");
    await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
    await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/admin");
    
    await page.goto("/admin/events/packages");
    const createForm = page.locator("form").filter({ hasText: "Create" });
    await createForm.locator("input[name='nameEn']").fill("Premium Corporate");
    await createForm.locator("textarea[name='descEn']").fill("Best for companies");
    await createForm.locator("input[name='price']").fill("1500");
    await createForm.locator("input[name='minGuests']").fill("20");
    await createForm.locator("button:has-text('Create')").click();
    
    // Check if error message is displayed
    await expect(page.locator(".text-danger")).not.toBeVisible();
    await expect(page.locator("h3:has-text('Edit: Premium Corporate')")).toBeVisible();

    // 2. Customer visits /events and sees the package
    const publicPage = await context.newPage();
    await publicPage.goto("/events");
    await expect(publicPage.locator("text=Premium Corporate").first()).toBeVisible();
    await expect(publicPage.locator("text=1,500").first()).toBeVisible(); // formatINR adds comma

    // 3. Customer submits an enquiry
    await publicPage.fill("input[name='name']", "My E2E Test Customer");
    await publicPage.fill("input[name='phone']", "9876543210");
    await publicPage.fill("input[name='eventDate']", "2026-12-10");
    await publicPage.fill("input[name='guests']", "30");
    await publicPage.selectOption("select[name='eventType']", "CORPORATE");
    await publicPage.selectOption("select[name='packageId']", { label: "Premium Corporate" });
    await publicPage.fill("textarea[name='message']", "We need a projector");
    
    await publicPage.click("button:has-text('Submit Enquiry')");
    await expect(publicPage.locator("text=Enquiry Received")).toBeVisible();
    await publicPage.close();

    // 4. Owner or Staff quotes it
    await page.goto("/admin/events");
    
    const enquiryRow = page.locator("div.border").filter({ hasText: "My E2E Test Customer" }).first();
    await expect(enquiryRow).toBeVisible();
    await expect(enquiryRow.locator("text=Premium Corporate").first()).toBeVisible();

    await enquiryRow.locator("input[placeholder='Notes']").fill("Looks good");
    await enquiryRow.locator("input[placeholder='Quote']").fill("45000"); // 30 * 1500
    
    // We mock the confirm
    page.on('dialog', dialog => dialog.accept());
    await enquiryRow.locator("button:has-text('→ Quoted')").click();
    
    // Check if it updated
    await expect(enquiryRow.locator("text=45,000")).toBeVisible();
    await expect(enquiryRow.locator("text=Quoted").first()).toBeVisible();
  });

  test("Hindi and a11y on public events page", async ({ page }) => {
    await page.goto("/events");
    await page.evaluate(() => { document.cookie = "NEXT_LOCALE=hi; path=/;"; });
    await page.reload();

    await expect(page.locator("text=पूछताछ भेजें")).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
  });
});
