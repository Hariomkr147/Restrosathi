import { prisma } from "../db";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { sendNow } from "../whatsapp/outbox";
import { notify } from "../whatsapp/notify";
import { setPhoneVerifiedCookie } from "./verified-cookie";
import { checkRate } from "../rate-limit";

function getSecret() {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error("OTP_SECRET not set");
  return secret;
}

function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", getSecret()).update(`${phone}:${code}`).digest("hex");
}

import { normalizePhone } from "../phone";
function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{10,14}$/.test(phone);
}

export async function requestOtp(rawPhone: string, ctx: { ip: string; now?: Date }): Promise<{ ok: true } | { ok: false; error: "INVALID_PHONE" | "RATE_LIMITED" }> {
  const phone = normalizePhone(rawPhone);
  if (!phone || !isValidE164(phone)) return { ok: false, error: "INVALID_PHONE" };

  const now = ctx.now ?? new Date();
  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  const codeHash = hashOtp(phone, code);
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  let msgId: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      const ipOk = await checkRate(`otp:ip:${ctx.ip}`, 20, 60 * 60 * 1000, tx);
      const phoneOk = await checkRate(`otp:phone:${phone}`, 3, 60 * 60 * 1000, tx);
      if (!ipOk || !phoneOk) throw new Error("RATE_LIMITED");

      await tx.otpCode.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: now }
      });

      await tx.otpCode.create({
        data: { phone, codeHash, expiresAt, createdAt: now }
      });

      const res = await notify("OTP", phone, { otp: code, minutes: 10 }, { tx });
      if ("id" in res) msgId = res.id;
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "RATE_LIMITED") return { ok: false, error: "RATE_LIMITED" };
    throw err;
  }

  if (msgId) await sendNow(msgId);
  return { ok: true };
}

export async function verifyOtp(rawPhone: string, code: string, ctx: { now?: Date }): Promise<{ ok: true } | { ok: false; error: "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "INVALID_PHONE" }> {
  const phone = normalizePhone(rawPhone);
  if (!phone || !isValidE164(phone)) return { ok: false, error: "INVALID_PHONE" };
  const now = ctx.now ?? new Date();

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'otp:' + phone}, 0))`;

    const otp = await tx.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" }
    });

    if (!otp) return { ok: false, error: "INVALID" } as const;
    if (otp.attempts >= 5) return { ok: false, error: "TOO_MANY_ATTEMPTS" } as const;

    const expectedHash = hashOtp(phone, code);
    const isValid = timingSafeEqual(Buffer.from(otp.codeHash, "hex"), Buffer.from(expectedHash, "hex"));

    if (!isValid) {
      const newAttempts = otp.attempts + 1;
      await tx.otpCode.update({
        where: { id: otp.id },
        data: {
          attempts: newAttempts,
          consumedAt: newAttempts >= 5 ? now : null
        }
      });
      return { ok: false, error: newAttempts >= 5 ? "TOO_MANY_ATTEMPTS" : "INVALID" } as const;
    }

    if (otp.expiresAt <= now) {
      await tx.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: now }
      });
      return { ok: false, error: "EXPIRED" } as const;
    }

    await tx.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: now }
    });

    return { ok: true, phone } as const;
  }).then(async (res) => {
    if (res.ok) {
      const { upsertCustomer } = await import("../customers");
      await upsertCustomer(res.phone, { verified: true });
      await setPhoneVerifiedCookie(res.phone, now.getTime());
      return { ok: true };
    }
    return res;
  });
}
