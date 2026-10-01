import { test, expect } from "@playwright/test";

test("admin requires login, owner logs in and logout removes access", async ({ page, context }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("Owner", { exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find((value) => value.name === "rs_session")!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: true });
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 11.9 * 3600);
  expect(cookie.expires).toBeLessThan(Date.now() / 1000 + 12 * 3600 + 60);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((value) => value.name === "rs_session")).toBe(false);
  await page.goto("/admin");
  await expect(page).toHaveURL("/login");
});

test("staff sees a wrong-PIN message then enters a PIN on the large keypad", async ({ page }) => {
  await page.goto("/login/staff");
  await page.getByLabel("Staff member", { exact: true }).selectOption({ label: "Ravi" });
  await page.getByLabel("4–6 digit PIN", { exact: true }).fill(process.env.SEED_STAFF_PIN === "654321" ? "1111" : "654321");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Phone, password or PIN is incorrect." })).toBeVisible();
  await page.getByRole("button", { name: "Clear PIN", exact: true }).click();
  for (const digit of "0123456789") {
    const box = await page.getByRole("button", { name: digit, exact: true }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  for (const digit of process.env.SEED_STAFF_PIN!) await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("Ravi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("login pages support Hindi, keyboard focus and long text without overflow", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("button", { name: /हिन्दी|Hindi/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByLabel("फ़ोन नंबर", { exact: true })).toBeVisible();
  await page.goto("/login/staff");
  await expect(page.getByRole("heading", { name: "कर्मचारी का पिन से प्रवेश" })).toBeVisible();
  const pin = page.getByLabel("4–6 अंकों का पिन", { exact: true });
  await pin.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "1", exact: true })).toBeFocused();
  expect(await page.getByRole("button", { name: "1", exact: true }).evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.locator("h1").evaluate((heading) => { heading.textContent = "कर्मचारी का सुरक्षित प्रवेश और रेस्तराँ के कार्यक्षेत्र में काम करने की सुविधा ".repeat(3); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("auth-hi.png"), fullPage: true });
  await pin.fill(process.env.SEED_STAFF_PIN!);
  await page.getByRole("button", { name: "प्रवेश करें", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("भूमिका: कर्मचारी", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "बाहर निकलें", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("login network failure keeps credentials and allows retry", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Phone number", { exact: true }).fill("+919999900001");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") await route.abort();
    else await route.continue();
  });
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not log in. Check your connection and try again." })).toBeVisible();
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveValue("+919999900001");
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
  await page.unroute("**/*");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/admin");
});
