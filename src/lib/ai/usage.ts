import { prisma } from "../db";
import { audit } from "../audit";

export async function consumeDeviceQuota(deviceId: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const limit = parseInt(process.env.AI_DEVICE_DAILY_LIMIT || "20", 10);
  
  // atomic upsert-and-increment against AI_DEVICE_DAILY_LIMIT
  const row = await prisma.aiDeviceUsage.upsert({
    where: { deviceId_day: { deviceId, day } },
    update: { calls: { increment: 1 } },
    create: { deviceId, day, calls: 1 }
  });

  if (row.calls > limit) {
    return false;
  }
  return true;
}

export async function consumeMonthlyQuota(): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const limit = parseInt(process.env.AI_MONTHLY_CAP || "2000", 10);

  try {
    await prisma.aiUsage.upsert({
      where: { month },
      update: {}, // don't increment here, we do it safely below
      create: { month, calls: 0, warned: false }
    });
  } catch {
    // ignore
  }

  // atomic monthly cap
  const updated = await prisma.$executeRaw`
    UPDATE "AiUsage"
    SET calls = calls + 1
    WHERE month = ${month} AND calls < ${limit}
  `;

  if (updated === 0) {
    return false;
  }

  // Check if we reached 80% to audit
  const threshold = Math.floor(limit * 0.8);
  const updatedTo80 = await prisma.$executeRaw`
    UPDATE "AiUsage"
    SET warned = true
    WHERE month = ${month} AND calls >= ${threshold} AND warned = false
  `;

  if (updatedTo80 > 0) {
    await audit({
      actorId: null,
      action: "ai.cap80",
      entity: "AiUsage",
      entityId: month,
      data: { limit, threshold }
    });
  }

  return true;
}
