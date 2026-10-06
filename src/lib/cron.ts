import crypto from "node:crypto";

export function verifyCronSecret(header: string | null): boolean {
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  const secret = process.env.CRON_SECRET || "";
  if (!token || !secret || token.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}
