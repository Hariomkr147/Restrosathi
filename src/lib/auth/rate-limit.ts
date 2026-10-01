import { prisma } from "../db";

const windowMs = 15 * 60_000;

export async function isLockedOut(keys: string[]): Promise<boolean> {
  const now = Date.now();
  const attempts = await prisma.loginAttempt.findMany({
    where: { key: { in: keys }, at: { gte: new Date(now - 2 * windowMs) } },
    orderBy: { at: "asc" }, select: { key: true, at: true },
  });
  const byKey = new Map<string, number[]>();
  for (const attempt of attempts) {
    const times = byKey.get(attempt.key) ?? [];
    const at = attempt.at.getTime();
    times.push(at);
    byKey.set(attempt.key, times);
    // Five failures within a window lock the key for a full window after the fifth.
    if (times.length >= 5 && at > now - windowMs && at - times[times.length - 5] <= windowMs) return true;
  }
  return false;
}

export async function recordFailure(keys: string[]): Promise<void> {
  await prisma.loginAttempt.createMany({ data: [...new Set(keys)].map((key) => ({ key })) });
}
