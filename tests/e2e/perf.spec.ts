import { test, expect, type Page, type TestInfo } from "@playwright/test";

async function checkMenuBudget(page: Page, testInfo: TestInfo) {
  const scripts: Promise<{ url: string; bytes: number }>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      scripts.push(response.request().sizes().then((size) => ({ url: response.url(), bytes: size.responseBodySize })));
    }
  });
  const response = await page.goto("/menu", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Menu", exact: true })).toBeVisible();
  const sizes = await Promise.all(scripts);
  expect(sizes.length).toBeGreaterThan(0);
  const totalJsBytes = sizes.reduce((total, script) => total + script.bytes, 0);
  console.log(`Menu JavaScript: ${totalJsBytes} / ${150 * 1024} bytes`);
  await testInfo.attach("script-sizes", { body: JSON.stringify(sizes, null, 2), contentType: "application/json" });
  expect(totalJsBytes).toBeLessThanOrEqual(150 * 1024);
}

test("menu initial JavaScript is at most 150KB encoded", async ({ page }, testInfo) => {
  await checkMenuBudget(page, testInfo);
});

test("menu with an uploaded photo meets the same JavaScript budget", async ({ page, browser, baseURL }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/menu/butter-naan");
  await page.locator("#photo").setInputFiles("src/lib/menu/__fixtures__/tiny.png");
  await expect(page.getByRole("img", { name: "Butter Naan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page).toHaveURL("/admin/menu");
  const coldContext = await browser.newContext({ baseURL });
  try {
    const publicPage = await coldContext.newPage();
    await checkMenuBudget(publicPage, testInfo);
    const photo = publicPage.getByTestId("dish-Butter Naan").getByRole("img");
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  } finally {
    await coldContext.close();
    await page.goto("/admin/menu/butter-naan");
    await page.getByRole("button", { name: "Remove photo", exact: true }).click();
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page).toHaveURL("/admin/menu");
  }
});
