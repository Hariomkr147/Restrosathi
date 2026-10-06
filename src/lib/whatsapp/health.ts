import { prisma } from "../db";
import { getWhatsApp } from "./index";

let cachedStatus: { status: "connected" | "disconnected" | "unknown"; ts: number } | null = null;

export async function getWhatsAppHealth(): Promise<{ status: "connected" | "disconnected" | "unknown"; pending: number; failed: number }> {
  const now = Date.now();
  if (!cachedStatus || now - cachedStatus.ts > 30000) {
    const provider = getWhatsApp();
    cachedStatus = {
      status: await provider.status(),
      ts: now,
    };
  }

  const pending = await prisma.messageLog.count({ where: { status: "PENDING", direction: "OUT" } });
  const failed = await prisma.messageLog.count({ where: { status: "FAILED", direction: "OUT" } });

  return {
    status: cachedStatus.status,
    pending,
    failed
  };
}
