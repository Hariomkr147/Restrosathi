/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db";
import { runRetention } from "./index";
import crypto from "crypto";

describe("runRetention", () => {
  beforeEach(async () => {
    await prisma.otpCode.deleteMany();
    await prisma.rateHit.deleteMany();
    await prisma.loginAttempt.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.messageLog.deleteMany();
    await prisma.aiDeviceUsage.deleteMany();
  });

  it("deletes old rows and keeps fresh ones", async () => {
    const now = new Date("2026-10-06T12:00:00Z");

    // OtpCode: delete > 1 day
    await prisma.otpCode.create({ data: { phone: "+919999900000", codeHash: "x", expiresAt: now, createdAt: new Date(now.getTime() - 25 * 3600 * 1000) } });
    await prisma.otpCode.create({ data: { phone: "+919999900000", codeHash: "y", expiresAt: now, createdAt: new Date(now.getTime() - 23 * 3600 * 1000) } });

    // RateHit: delete > 2 days
    await prisma.rateHit.create({ data: { key: "x", at: new Date(now.getTime() - 49 * 3600 * 1000) } });
    await prisma.rateHit.create({ data: { key: "y", at: new Date(now.getTime() - 47 * 3600 * 1000) } });

    // LoginAttempt: delete > 1 day
    await prisma.loginAttempt.create({ data: { key: "x", at: new Date(now.getTime() - 25 * 3600 * 1000) } });
    await prisma.loginAttempt.create({ data: { key: "y", at: new Date(now.getTime() - 23 * 3600 * 1000) } });

    // AuthSession: expired vs active
    const user = await prisma.user.create({ data: { name: "Test", role: "STAFF" } });
    await prisma.authSession.create({ data: { tokenHash: "expired", userId: user.id, expiresAt: new Date(now.getTime() - 1000) } });
    await prisma.authSession.create({ data: { tokenHash: "active", userId: user.id, expiresAt: new Date(now.getTime() + 1000) } });

    // MessageLog: > 24 months
    await prisma.messageLog.create({ data: { direction: "IN", phone: "+91", status: "RECEIVED", createdAt: new Date(now.getFullYear() - 2, now.getMonth() - 1, now.getDate()) } });
    await prisma.messageLog.create({ data: { direction: "IN", phone: "+91", status: "RECEIVED", createdAt: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) } });

    // AiDeviceUsage: > 30 days
    const oldDayIso = new Date(now.getTime() - 31 * 86400 * 1000).toISOString().slice(0, 10);
    const recentDayIso = new Date(now.getTime() - 29 * 86400 * 1000).toISOString().slice(0, 10);
    await prisma.aiDeviceUsage.create({ data: { deviceId: "x", day: oldDayIso, calls: 1 } });
    await prisma.aiDeviceUsage.create({ data: { deviceId: "x", day: recentDayIso, calls: 1 } });

    const result = await runRetention({ now });

    expect(result).toEqual({
      otpCodes: 1,
      rateHits: 1,
      loginAttempts: 1,
      authSessions: 1,
      messageLogs: 1,
      aiDeviceUsage: 1,
    });

    // Check what is left
    expect(await prisma.otpCode.count()).toBe(1);
    expect(await prisma.rateHit.count()).toBe(1);
    expect(await prisma.loginAttempt.count()).toBe(1);
    expect(await prisma.authSession.count()).toBe(1);
    expect(await prisma.messageLog.count()).toBe(1);
    expect(await prisma.aiDeviceUsage.count()).toBe(1);
  });

  it("POST /api/cron/retention rejects wrong secret", async () => {
    const { POST } = await import("@/app/api/cron/retention/route");
    const req = new Request("http://localhost/api/cron/retention", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
