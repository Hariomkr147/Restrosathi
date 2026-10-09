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
      WHATSAPP_PROVIDER: "akg",
      ALLOW_FAKE_WA: "0",
      CRON_URL: "https://example.com/api/cron/trigger",
      ENABLE_AI: "0"
    },
    settings: {
      name: "Real Restaurant",
      taxMode: "NONE",
      taxModeConfirmedAt: new Date(),
      address: "123 Example Street",
      phone: "+919999900000",
      ownerPhone: "+919999900000",
      hours: "Mon-Sun 9am-10pm"
    },
    users: [
      { id: "1", role: "OWNER", passwordHash: "x" }
    ],
    demoCredentialResults: [
      { id: "1", hasDemoCredential: false }
    ],
    tables: [{ id: "1" }],
    itemCount: 10,
    lastBackup: { at: new Date() }
  };

  it("passes with valid snapshot", () => {
    const results = checkPreflight(baseSnapshot);
    const errors = results.filter(r => !r.ok && r.type === "error");
    expect(errors).toHaveLength(0);
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

  it("fails if demo credentials are true", () => {
    const results = checkPreflight({ 
      ...baseSnapshot, 
      demoCredentialResults: [{ id: "1", hasDemoCredential: true }] 
    });
    const res = results.find(r => r.name === "No demo credentials");
    expect(res?.ok).toBe(false);
  });
  
  it("emits warnings instead of failing for AI/FSSAI", () => {
    const results = checkPreflight(baseSnapshot);
    const warnings = results.filter(r => !r.ok && r.type === "warning");
    expect(warnings.length).toBeGreaterThan(0); // FSSAI warning expected
    
    // Check that AI is warned if missing
    const res = results.find(r => r.name === "AI enabled");
    expect(res?.ok).toBe(false);
    expect(res?.type).toBe("warning");
  });
});
