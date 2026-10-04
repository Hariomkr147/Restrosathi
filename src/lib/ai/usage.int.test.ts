import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { consumeDeviceQuota, consumeMonthlyQuota } from "./usage";
import { db, resetOperationalData } from "../../../tests/helpers/db";

describe("AI Usage limits", () => {
  beforeEach(async () => {
    await resetOperationalData();
    await db.aiUsage.deleteMany();
    await db.aiDeviceUsage.deleteMany();
    await db.auditLog.deleteMany();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits device to 20 per day, another device unaffected, resets next day", async () => {
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const dev1 = "dev1";
    const dev2 = "dev2";
    
    // Use up 20 calls for dev1
    for (let i = 0; i < 20; i++) {
      expect(await consumeDeviceQuota(dev1)).toBe(true);
    }
    // 21st call fails
    expect(await consumeDeviceQuota(dev1)).toBe(false);
    
    // dev2 can still call
    expect(await consumeDeviceQuota(dev2)).toBe(true);

    // Reset next day
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    expect(await consumeDeviceQuota(dev1)).toBe(true);
  });

  it("caps monthly quota at 2000, emits audit at 80%, concurrent calls protected", async () => {
    // With cap 5 (we can pass cap to consumeMonthlyQuota or mock env var)
    process.env.AI_MONTHLY_CAP = "5";
    
    // 10 concurrent calls
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() => consumeMonthlyQuota())
    );
    
    const successes = results.filter((r) => r).length;
    const failures = results.filter((r) => !r).length;
    
    expect(successes).toBe(5);
    expect(failures).toBe(5);
    
    // exactly one ai.cap80 audit row
    const audits = await db.auditLog.findMany({ where: { action: "ai.cap80" } });
    expect(audits.length).toBe(1);

    // cleanup
    delete process.env.AI_MONTHLY_CAP;
  });
});
