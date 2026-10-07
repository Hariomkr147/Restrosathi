import { prisma } from "../db";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { sendNow } from "../whatsapp/outbox";
import { notify } from "../whatsapp/notify";
import { setPhoneVerifiedCookie } from "./verified-cookie";

function getSecret() {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error("OTP_SECRET not set");
  return secret;
}

function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", getSecret()).update(`${phone}:${code}`).digest("hex");
}

function cleanPhone(rawPhone: string): string {
  let cleaned = rawPhone.replace(/\D/g, "");
  if (!cleaned.startsWith("91") && cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return "+" + cleaned;
}

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{10,14}$/.test(phone);
}

export async function requestOtp(rawPhone: string, ctx: { ip: string; now?: Date }): Promise<{ ok: true } | { ok: false; error: "INVALID_PHONE" | "RATE_LIMITED" }> {
  const phone = cleanPhone(rawPhone);
  if (!isValidE164(phone)) return { ok: false, error: "INVALID_PHONE" };

  const now = ctx.now ?? new Date();

  // Rate limit: 3 per phone per hour
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentPhoneReqs = await prisma.otpCode.count({
    where: { phone, createdAt: { gt: oneHourAgo } }
  });
  if (recentPhoneReqs >= 3) return { ok: false, error: "RATE_LIMITED" };

  // Generate 6 digit code
  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  const codeHash = hashOtp(phone, code);
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  let msgId: string | undefined;
  await prisma.$transaction(async (tx) => {
    // Consume any older unconsumed codes for this phone
    await tx.otpCode.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: now }
    });

    await tx.otpCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
        createdAt: now
      }
    });

    const res = await notify("OTP", phone, { code, minutes: 10 }, { tx });
    if ("id" in res) msgId = res.id;
  });

  if (msgId) await sendNow(msgId);
  return { ok: true };
}

export async function verifyOtp(rawPhone: string, code: string, ctx: { now?: Date }): Promise<{ ok: true, phone: string } | { ok: false; error: "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "INVALID_PHONE" }> {
  const phone = cleanPhone(rawPhone);
  if (!isValidE164(phone)) return { ok: false, error: "INVALID_PHONE" };
  const now = ctx.now ?? new Date();

  // Find latest unconsumed code for this phone
  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });

  if (!otp) return { ok: false, error: "INVALID" };
  if (otp.attempts >= 5) return { ok: false, error: "TOO_MANY_ATTEMPTS" };

  const expectedHash = hashOtp(phone, code);
  const isValid = timingSafeEqual(Buffer.from(otp.codeHash, "hex"), Buffer.from(expectedHash, "hex"));

  if (!isValid) {
    const newAttempts = otp.attempts + 1;
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: {
        attempts: newAttempts,
        consumedAt: newAttempts >= 5 ? now : null
      }
    });
    return { ok: false, error: newAttempts >= 5 ? "TOO_MANY_ATTEMPTS" : "INVALID" };
  }

  if (otp.expiresAt <= now) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: now }
    });
    return { ok: false, error: "EXPIRED" };
  }

  // Success
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: now }
  });

  const { upsertCustomer } = await import("../customers");
  await upsertCustomer(phone, { verified: true });

  await setPhoneVerifiedCookie(phone, now.getTime());
  return { ok: true, phone };
}
