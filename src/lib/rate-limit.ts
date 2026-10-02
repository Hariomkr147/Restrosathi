import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function checkRate(key: string, limit: number, windowMs: number, tx?: Prisma.TransactionClient): Promise<boolean> {
  if (!tx) return prisma.$transaction((client) => checkRate(key, limit, windowMs, client), { maxWait: 20_000, timeout: 30_000 });
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  const since = new Date(Date.now() - windowMs);
  await tx.rateHit.deleteMany({ where: { key, at: { lt: since } } });
  if (await tx.rateHit.count({ where: { key, at: { gte: since } } }) >= limit) return false;
  await tx.rateHit.create({ data: { key } });
  return true;
}
