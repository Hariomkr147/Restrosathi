import { prisma } from "../db";
import fs from "fs/promises";
import path from "path";
import { getWhatsAppHealth } from "../whatsapp/health";

export async function runChecks(now: Date = new Date()) {
  const results: Array<{ key: string; ok: boolean; detail: string }> = [];

  // db
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.push({ key: "db", ok: true, detail: "ok" });
  } catch (e) {
    results.push({ key: "db", ok: false, detail: "Database query failed" });
  }

  // disk
  try {
    const stat = await fs.statfs(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bfree) * Number(stat.bsize);
    const used = total - free;
    const usedPercent = total > 0 ? (used / total) * 100 : 0;
    if (usedPercent > 85) {
      results.push({ key: "disk", ok: false, detail: `Disk used ${usedPercent.toFixed(1)}% (> 85%)` });
    } else {
      results.push({ key: "disk", ok: true, detail: `${usedPercent.toFixed(1)}% used` });
    }
  } catch (e) {
    results.push({ key: "disk", ok: false, detail: "Cannot statfs" });
  }

  // backup
  const lastBackup = await prisma.backupRun.findFirst({
    where: { ok: true },
    orderBy: { at: 'desc' }
  });
  if (!lastBackup) {
    results.push({ key: "backup", ok: false, detail: "No successful backup found" });
  } else {
    const ageHours = (now.getTime() - lastBackup.at.getTime()) / (1000 * 60 * 60);
    if (ageHours > 26) {
      results.push({ key: "backup", ok: false, detail: `Last successful backup was ${ageHours.toFixed(1)}h ago` });
    } else {
      results.push({ key: "backup", ok: true, detail: `Last backup ${ageHours.toFixed(1)}h ago` });
    }
  }

  // outbox
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const halfHourAgo = new Date(now.getTime() - 30 * 60 * 1000);
  
  const failedOutbox = await prisma.messageLog.count({
    where: { status: "FAILED", createdAt: { gte: hourAgo } }
  });
  const stuckOutbox = await prisma.messageLog.count({
    where: { status: "PENDING", createdAt: { lte: halfHourAgo } }
  });
  
  if (failedOutbox > 0 || stuckOutbox > 0) {
    results.push({ key: "outbox", ok: false, detail: `${failedOutbox} failed, ${stuckOutbox} stuck` });
  } else {
    results.push({ key: "outbox", ok: true, detail: "ok" });
  }

  // whatsapp
  const waHealth = await getWhatsAppHealth();
  if (waHealth.status === "disconnected") {
    let alertState = await prisma.alertState.findUnique({ where: { key: "whatsapp" } });
    if (!alertState || !alertState.firstFailedAt) {
      alertState = await prisma.alertState.upsert({
        where: { key: "whatsapp" },
        update: { firstFailedAt: now },
        create: { key: "whatsapp", active: false, firstFailedAt: now }
      });
    }
    const minutesDown = (now.getTime() - alertState.firstFailedAt.getTime()) / 60000;
    if (minutesDown > 30) {
      results.push({ key: "whatsapp", ok: false, detail: `Disconnected for ${Math.floor(minutesDown)} mins` });
    } else {
      results.push({ key: "whatsapp", ok: true, detail: `Disconnected for ${Math.floor(minutesDown)} mins` });
    }
  } else {
    await prisma.alertState.updateMany({
      where: { key: "whatsapp" },
      data: { firstFailedAt: null }
    });
    results.push({ key: "whatsapp", ok: true, detail: waHealth.status });
  }

  // ai
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const limit = parseInt(process.env.AI_MONTHLY_CAP || "2000", 10);
  const aiUsage = await prisma.aiUsage.findUnique({ where: { month } });
  const calls = aiUsage?.calls || 0;
  const aiPercent = (calls / limit) * 100;
  if (aiPercent >= 80) {
    results.push({ key: "ai", ok: false, detail: `AI quota ${Math.floor(aiPercent)}% used (${calls}/${limit})` });
  } else {
    results.push({ key: "ai", ok: true, detail: `AI quota ${Math.floor(aiPercent)}% used` });
  }

  // errors
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const recentErrors = await prisma.errorLog.count({
    where: { at: { gte: tenMinsAgo } }
  });
  if (recentErrors >= 20) {
    results.push({ key: "errors", ok: false, detail: `${recentErrors} errors in last 10 mins` });
  } else {
    results.push({ key: "errors", ok: true, detail: `${recentErrors} errors recently` });
  }

  return results;
}
