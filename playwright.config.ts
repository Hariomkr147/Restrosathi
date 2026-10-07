import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) process.loadEnvFile(".env");
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export default defineConfig({
  globalSetup: "./tests/setup/db.ts",
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // The public/admin checks share one restaurant's seeded settings and menu.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    port: 3001,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: "3001",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      UPLOAD_DIR: "test-results/uploads",
      WHATSAPP_PROVIDER: "fake",
      ALLOW_FAKE_WA: "1",
      FAKE_WA_OUTBOX: "test-results/fake-wa-outbox.jsonl",
      FAKE_WA_CONTROL: "test-results/fake-wa-control.txt",
      AI_PROVIDER: "fake",
      CRON_SECRET: "test-cron-secret",
      OTP_SECRET: "test-otp-secret",
      COOKIE_SECRET: "test-cookie-secret",
      WA_WEBHOOK_SECRET: "test-webhook-secret",
      RATE_LIMIT_IP_ORDERS_PER_HOUR: "100000",
    },
  },
});
