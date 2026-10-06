import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// For development only, we export these variables so tests can override them.
// In real use they are populated by process.env.COOKIE_SECRET.
export const _OTP_VERIFIED_COOKIE_NAME = "rs_verified";

function getSecret() {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error("COOKIE_SECRET not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

type Payload = {
  p: string[]; // List of verified phones, most recent first (max 5)
  e: number;   // Expiry in milliseconds
};

export async function setPhoneVerifiedCookie(phone: string, nowMs = Date.now()) {
  const cookieStore = await cookies();
  const existingStr = cookieStore.get(_OTP_VERIFIED_COOKIE_NAME)?.value;
  let phones: string[] = [];

  if (existingStr) {
    const parts = existingStr.split(".");
    if (parts.length === 2) {
      const [payloadB64, sig] = parts;
      const expectedSig = sign(payloadB64);
      if (
        Buffer.byteLength(sig) === Buffer.byteLength(expectedSig) &&
        timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expectedSig, "utf-8"))
      ) {
        try {
          const payload: Payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
          if (payload.e > nowMs) {
            phones = payload.p;
          }
        } catch {
          // invalid json, ignore
        }
      }
    }
  }

  // Add the new phone to the top, removing duplicates
  phones = [phone, ...phones.filter(p => p !== phone)].slice(0, 5);

  const expiryMs = nowMs + 180 * 24 * 60 * 60 * 1000; // 180 days
  const newPayload: Payload = { p: phones, e: expiryMs };
  const payloadB64 = Buffer.from(JSON.stringify(newPayload), "utf-8").toString("base64url");
  const newSig = sign(payloadB64);

  cookieStore.set(_OTP_VERIFIED_COOKIE_NAME, `${payloadB64}.${newSig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiryMs)
  });
}

export async function isPhoneVerified(phone: string, nowMs = Date.now()): Promise<boolean> {
  const cookieStore = await cookies();
  const existingStr = cookieStore.get(_OTP_VERIFIED_COOKIE_NAME)?.value;
  if (!existingStr) return false;

  const parts = existingStr.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, sig] = parts;
  const expectedSig = sign(payloadB64);

  if (Buffer.byteLength(sig) !== Buffer.byteLength(expectedSig)) return false;
  if (!timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expectedSig, "utf-8"))) return false;

  try {
    const payload: Payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (payload.e <= nowMs) return false;
    return payload.p.includes(phone);
  } catch {
    return false;
  }
}
