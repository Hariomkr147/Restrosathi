import { describe, it, expect } from "vitest";
import { checkPreflight } from "./preflight-checks";

describe("Preflight checks", () => {
  const baseSnapshot = {
    env: {
      NODE_ENV: "production",
      APP_URL: "https://example.com",
      CRON_SECRET: "12345678901234567890123456789012",
      OTP_SECRET: "12345678901234567890123456789012",
      COOKIE_SECRET: "12345678901234567890123456789012",
      WA_WEBHOOK_SECRET: "12345678901234567890123456789012",
      BACKUP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      WHATSAPP_PROVIDER: "wa-akg"
    },
    settings: {
      name: "Real Restaurant",
      taxMode: "NONE",
      taxModeConfirmedAt: new Date()
    },
    users: [
      { id: "1", role: "OWNER", passwordHash: "x" }
    ],
    tables: [{ id: "1" }],
    itemCount: 10,
    lastBackup: { at: new Date() }
  };

  it("passes with valid snapshot", () => {
    const results = checkPreflight(baseSnapshot);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it("fails if not production", () => {
    const results = checkPreflight({ ...baseSnapshot, env: { ...baseSnapshot.env, NODE_ENV: "development" } });
    const res = results.find(r => r.name === "Environment is production");
    expect(res?.ok).toBe(false);
  });
  
  it("fails if short secret", () => {
    const results = checkPreflight({ ...baseSnapshot, env: { ...baseSnapshot.env, CRON_SECRET: "short" } });
    const res = results.find(r => r.name === "Secret CRON_SECRET valid");
    expect(res?.ok).toBe(false);
  });
});
