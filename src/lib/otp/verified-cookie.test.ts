import { describe, expect, it, vi, beforeEach } from "vitest";
import { setPhoneVerifiedCookie, isPhoneVerified, _OTP_VERIFIED_COOKIE_NAME } from "./verified-cookie";

const cookieJar = new Map<string, { value: string; options?: unknown }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options: unknown) => cookieJar.set(name, { value, options }),
  }),
}));

describe("verified-cookie", () => {
  beforeEach(() => {
    cookieJar.clear();
    process.env.COOKIE_SECRET = "test-secret-123";
  });

  it("sets a cookie that can be verified", async () => {
    const now = Date.now();
    await setPhoneVerifiedCookie("+919999900000", now);
    
    expect(cookieJar.has(_OTP_VERIFIED_COOKIE_NAME)).toBe(true);
    expect(await isPhoneVerified("+919999900000", now)).toBe(true);
  });

  it("fails verification if expired", async () => {
    const now = Date.now();
    await setPhoneVerifiedCookie("+919999900000", now);
    
    // Check 180 days + 1 ms later
    const future = now + 180 * 24 * 60 * 60 * 1000 + 1;
    expect(await isPhoneVerified("+919999900000", future)).toBe(false);
  });

  it("fails verification if tampered", async () => {
    const now = Date.now();
    await setPhoneVerifiedCookie("+919999900000", now);
    
    const cookie = cookieJar.get(_OTP_VERIFIED_COOKIE_NAME)!;
    const parts = cookie.value.split(".");
    
    // Tamper the payload
    cookieJar.set(_OTP_VERIFIED_COOKIE_NAME, { value: `tampered.${parts[1]}` });
    expect(await isPhoneVerified("+919999900000", now)).toBe(false);

    // Tamper the signature
    cookieJar.set(_OTP_VERIFIED_COOKIE_NAME, { value: `${parts[0]}.badsignature0000000000000000000` });
    expect(await isPhoneVerified("+919999900000", now)).toBe(false);
  });

  it("keeps up to 5 phones, newest first", async () => {
    const now = Date.now();
    await setPhoneVerifiedCookie("+919999900001", now);
    await setPhoneVerifiedCookie("+919999900002", now);
    await setPhoneVerifiedCookie("+919999900003", now);
    await setPhoneVerifiedCookie("+919999900004", now);
    await setPhoneVerifiedCookie("+919999900005", now);
    await setPhoneVerifiedCookie("+919999900006", now);

    expect(await isPhoneVerified("+919999900001", now)).toBe(false); // Evicted
    expect(await isPhoneVerified("+919999900002", now)).toBe(true);
    expect(await isPhoneVerified("+919999900006", now)).toBe(true);
  });

  it("deduplicates the same phone and brings it to top", async () => {
    const now = Date.now();
    await setPhoneVerifiedCookie("+919999900001", now);
    await setPhoneVerifiedCookie("+919999900002", now);
    await setPhoneVerifiedCookie("+919999900001", now); // Bring 1 back to top
    
    // Add 4 more
    await setPhoneVerifiedCookie("+919999900003", now);
    await setPhoneVerifiedCookie("+919999900004", now);
    await setPhoneVerifiedCookie("+919999900005", now);
    await setPhoneVerifiedCookie("+919999900006", now);

    // 2 should be evicted (as 1 was bumped to the top)
    expect(await isPhoneVerified("+919999900002", now)).toBe(false);
    expect(await isPhoneVerified("+919999900001", now)).toBe(true);
  });
});
