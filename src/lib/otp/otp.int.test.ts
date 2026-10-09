/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { requestOtp, verifyOtp } from "./index";
import { prisma } from "../db";
import { _OTP_VERIFIED_COOKIE_NAME, isPhoneVerified } from "./verified-cookie";

const cookieJar = new Map<string, { value: string; options?: unknown }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options: unknown) => cookieJar.set(name, { value, options }),
  }),
}));

describe("OTP verification", () => {
  beforeEach(async () => {
    cookieJar.clear();
    process.env.OTP_SECRET = "test-otp-secret";
    process.env.COOKIE_SECRET = "test-cookie-secret";
    await prisma.otpCode.deleteMany();
    await prisma.messageLog.deleteMany();
    await prisma.rateHit.deleteMany();
  });

  it("requests OTP, verifies correctly and sets cookie", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    const res = await requestOtp("9999900000", { ip: "127.0.0.1", now });
    expect(res).toEqual({ ok: true });

    const msg = await prisma.messageLog.findFirst({ orderBy: { createdAt: "desc" } });
    expect(msg?.kind).toBe("OTP");
    
    // Extract code from message params (since we don't store it plain text in DB)
    const params = msg?.params as { otp: string };
    const code = params.otp;
    expect(code).toMatch(/^\d{6}$/);

    const verifyRes = await verifyOtp("+919999900000", code, { now: new Date(now.getTime() + 60000) });
    expect(verifyRes).toMatchObject({ ok: true });
    
    expect(await isPhoneVerified("+919999900000", now.getTime() + 60000)).toBe(true);

    // cannot be reused
    const reuse = await verifyOtp("+919999900000", code, { now: new Date(now.getTime() + 60000) });
    expect(reuse).toEqual({ ok: false, error: "INVALID" });
  });

  it("expires after 10 minutes", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    await requestOtp("9999900000", { ip: "127.0.0.1", now });

    const msg = await prisma.messageLog.findFirst({ orderBy: { createdAt: "desc" } });
    const code = (msg?.params as { otp: string }).otp;

    // 10m + 1s later
    const future = new Date(now.getTime() + 10 * 60 * 1000 + 1000);
    const verifyRes = await verifyOtp("+919999900000", code, { now: future });
    expect(verifyRes).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("fails after 5 wrong attempts", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    await requestOtp("9999900000", { ip: "127.0.0.1", now });

    const msg = await prisma.messageLog.findFirst({ orderBy: { createdAt: "desc" } });
    const correctCode = (msg?.params as { otp: string }).otp;

    for (let i = 0; i < 4; i++) {
      expect(await verifyOtp("9999900000", "000000", { now })).toEqual({ ok: false, error: "INVALID" });
    }
    
    // 5th wrong attempt trips TOO_MANY_ATTEMPTS
    expect(await verifyOtp("9999900000", "000000", { now })).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });

    // Even correct code fails now because the code was consumed
    expect(await verifyOtp("9999900000", correctCode, { now })).toEqual({ ok: false, error: "INVALID" });
  });

  it("enforces rate limit of 3 sends per hour", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-10-06T10:00:00Z");
      vi.setSystemTime(now);
      expect(await requestOtp("9999900000", { ip: "127.0.0.1", now })).toEqual({ ok: true });
      expect(await requestOtp("9999900000", { ip: "127.0.0.1", now })).toEqual({ ok: true });
      expect(await requestOtp("9999900000", { ip: "127.0.0.1", now })).toEqual({ ok: true });
      
      expect(await requestOtp("9999900000", { ip: "127.0.0.1", now })).toEqual({ ok: false, error: "RATE_LIMITED" });

      // 1 hour later it works again
      const future = new Date(now.getTime() + 60 * 60 * 1000 + 1000);
      vi.setSystemTime(future);
      expect(await requestOtp("9999900000", { ip: "127.0.0.1", now: future })).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalidates previous codes on new request", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    await requestOtp("9999900000", { ip: "127.0.0.1", now });
    const msg1 = await prisma.messageLog.findFirst({ orderBy: { createdAt: "desc" } });
    const code1 = (msg1?.params as { otp: string }).otp;

    await requestOtp("9999900000", { ip: "127.0.0.1", now });
    const msg2 = await prisma.messageLog.findFirst({ orderBy: { createdAt: "desc" } });
    const code2 = (msg2?.params as { otp: string }).otp;

    expect(await verifyOtp("9999900000", code1, { now })).toEqual({ ok: false, error: "INVALID" });
    expect(await verifyOtp("9999900000", code2, { now })).toMatchObject({ ok: true });
  });

  it("handles concurrent consumption correctly", async () => {
    const now = new Date("2026-10-06T10:00:00Z");
    await requestOtp("9999900000", { ip: "127.0.0.1", now });

    const msg = await prisma.messageLog.findFirst({ orderBy: { createdAt: "desc" } });
    const code = (msg?.params as { otp: string }).otp;

    // Simulate concurrent attempts with the correct code
    const results = await Promise.all([
      verifyOtp("9999900000", code, { now }),
      verifyOtp("9999900000", code, { now }),
      verifyOtp("9999900000", code, { now })
    ]);

    const successes = results.filter((r) => r.ok).length;
    expect(successes).toBe(1); // Only one should succeed
    
    const failures = results.filter((r) => !r.ok).length;
    expect(failures).toBe(2);
  });
});
