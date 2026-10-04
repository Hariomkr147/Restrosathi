import { test, expect } from "@playwright/test";
import { TABLE_CODES, resetOperationalData, createOrderableItem } from "../helpers/db";

test.beforeEach(async () => {
  await resetOperationalData();
  await createOrderableItem();
});

test("Ask the menu works", async ({ page, context }) => {
  await page.goto(`/t/${TABLE_CODES[0]}`);

  // Find Ask the menu button
  const askBtn = page.getByRole("button", { name: "Ask the menu" }); // Or whatever we name it
  await expect(askBtn).toBeVisible();
  await askBtn.click();

  // Ask question
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("textbox").fill("kuch spicy veg batao");
  await sheet.getByRole("button", { name: "Send" }).click();

  // Fake provider should return options
  await expect(sheet.getByText("Here are some options.")).toBeVisible();
  
  // The Demo Platter should appear
  await expect(sheet.getByText("Demo platter")).toBeVisible();
  const addBtn = sheet.getByRole("button", { name: "Add" }).first();
  await expect(addBtn).toBeVisible();
});

test("Allergy question shows confirm message", async ({ page }) => {
  await page.goto(`/t/${TABLE_CODES[0]}`);

  await page.getByRole("button", { name: "Ask the menu" }).click();
  const sheet = page.getByRole("dialog");
  
  // "allergy" word
  await sheet.getByRole("textbox").fill("mujhe peanut allergy hai");
  await sheet.getByRole("button", { name: "Send" }).click();

  // allergy fixed message
  // E.g. "please confirm with staff" - we'll check whatever string we use.
  await expect(sheet.getByText(/please confirm with staff|allergy/i)).toBeVisible();
});
