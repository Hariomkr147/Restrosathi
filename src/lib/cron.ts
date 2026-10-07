import crypto from "node:crypto";

export function verifyCronSecret(header: string | null): boolean {
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  const secret = process.env.CRON_SECRET || "";
  if (!token || !secret) return false;
  const tokenBuf = Buffer.from(token, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");
  if (tokenBuf.byteLength !== secretBuf.byteLength) return false;
  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}
