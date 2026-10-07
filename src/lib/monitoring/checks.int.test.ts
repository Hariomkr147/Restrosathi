import { describe, it, expect, beforeEach } from "vitest";
import { runChecks } from "./checks";
import { prisma } from "../db";

describe("runChecks", () => {
  beforeEach(async () => {
    process.env.ALLOW_FAKE_WA = "1";
    await prisma.backupRun.deleteMany({});
    await prisma.messageLog.deleteMany({});
    await prisma.alertState.deleteMany({});
    await prisma.errorLog.deleteMany({});
  });

  it("returns ok for all checks when system is healthy", async () => {
    await prisma.backupRun.create({
      data: { at: new Date(), ok: true }
    });
    
    const results = await runChecks();
    
    expect(results.find(r => r.key === "db")?.ok).toBe(true);
    expect(results.find(r => r.key === "disk")?.ok).toBe(true);
    expect(results.find(r => r.key === "backup")?.ok).toBe(true);
    expect(results.find(r => r.key === "outbox")?.ok).toBe(true);
    expect(results.find(r => r.key === "ai")?.ok).toBe(true);
    expect(results.find(r => r.key === "errors")?.ok).toBe(true);
  });

  it("fails checks when conditions are met", async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 27 * 60 * 60 * 1000);
    await prisma.backupRun.create({ data: { at: oldDate, ok: true } });
    
    await prisma.messageLog.create({
      data: { phone: "123", direction: "OUT", status: "FAILED" }
    });
    
    const errors = Array.from({ length: 20 }).map((_, i) => ({
      where: "test", message: "m" + i, digest: "d" + i
    }));
    await prisma.errorLog.createMany({ data: errors });
    
    const results = await runChecks(now);
    
    expect(results.find(r => r.key === "backup")?.ok).toBe(false);
    expect(results.find(r => r.key === "outbox")?.ok).toBe(false);
    expect(results.find(r => r.key === "errors")?.ok).toBe(false);
  });
});
