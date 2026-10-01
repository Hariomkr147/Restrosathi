import { z } from "zod";
import { prisma } from "../db";
import { verifySecret } from "./password";
import { isLockedOut, recordFailure } from "./rate-limit";

export type LoginResult = { userId: string } | { error: "invalid" | "locked" };
const passwordInput = z.object({ phone: z.string().trim().regex(/^\+91\d{10}$/), password: z.string().min(1).max(128) });
const pinInput = z.object({ userId: z.string().min(1).max(100), pin: z.string().regex(/^\d{4,6}$/) });

async function checkCredential(user: { id: string; active: boolean } | null, stored: string | null | undefined, secret: string, keys: string[]): Promise<LoginResult> {
  if (await isLockedOut(keys)) return { error: "locked" };
  if (!user?.active || !stored || !await verifySecret(secret, stored)) {
    await recordFailure(keys);
    return { error: "invalid" };
  }
  return { userId: user.id };
}

export async function checkPasswordLogin(form: unknown, ip: string): Promise<LoginResult> {
  const input = passwordInput.safeParse(form);
  if (!input.success) return checkCredential(null, null, "", [`ip:${ip}`]);
  const user = await prisma.user.findFirst({ where: { phone: input.data.phone, role: "OWNER" } });
  return checkCredential(user, user?.passwordHash, input.data.password, [`user:${user?.id ?? `phone:${input.data.phone}`}`, `ip:${ip}`]);
}

export async function checkPinLogin(form: unknown, ip: string): Promise<LoginResult> {
  const input = pinInput.safeParse(form);
  if (!input.success) return checkCredential(null, null, "", [`ip:${ip}`]);
  const user = await prisma.user.findFirst({ where: { id: input.data.userId, role: "STAFF" } });
  return checkCredential(user, user?.pinHash, input.data.pin, [`user:${input.data.userId}`, `ip:${ip}`]);
}
