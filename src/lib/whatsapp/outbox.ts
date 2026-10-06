import { prisma } from "../db";
import { getWhatsApp } from "./index";
import { WhatsAppProvider } from "./provider";
import { renderMessage } from "./notify";
import type { MessageKind } from "./notify";

const BACKOFF = [1 * 60, 5 * 60, 15 * 60, 60 * 60, 3 * 60 * 60];

export async function processOutbox({ now = new Date(), limit = 20, provider }: { now?: Date; limit?: number; provider?: WhatsAppProvider } = {}): Promise<{ sent: number; failed: number; retried: number }> {
  const actualProvider = provider || getWhatsApp();
  
  // Claim rows
  const claimed: any[] = await prisma.$queryRaw`
    UPDATE "MessageLog"
    SET "nextAttemptAt" = ${new Date(now.getTime() + 2 * 60 * 1000)}
    WHERE id IN (
      SELECT id FROM "MessageLog"
      WHERE status = 'PENDING'::"MessageStatus" AND "nextAttemptAt" <= ${now}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;

  if (!claimed || claimed.length === 0) {
    return { sent: 0, failed: 0, retried: 0 };
  }

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const row of claimed) {
    try {
      const text = renderMessage(row.kind as MessageKind, row.params, row.locale);
      const res = await actualProvider.sendText(row.phone, text);
      
      const isOTP = row.kind === "OTP";
      await prisma.messageLog.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          providerId: res.providerId,
          attempts: row.attempts + 1,
          params: isOTP ? {} : undefined,
        }
      });
      sent++;
    } catch (err: any) {
      const attempts = row.attempts + 1;
      const isOTP = row.kind === "OTP";
      
      if (attempts >= 5) {
        await prisma.messageLog.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            attempts,
            lastError: String(err).slice(0, 300),
            params: isOTP ? {} : undefined,
          }
        });
        failed++;
      } else {
        const delaySecs = BACKOFF[attempts - 1] || BACKOFF[BACKOFF.length - 1];
        await prisma.messageLog.update({
          where: { id: row.id },
          data: {
            status: "PENDING",
            attempts,
            lastError: String(err).slice(0, 300),
            nextAttemptAt: new Date(now.getTime() + delaySecs * 1000),
          }
        });
        retried++;
      }
    }
  }

  return { sent, failed, retried };
}

export async function sendNow(id: string): Promise<void> {
  const row = await prisma.messageLog.findUnique({ where: { id } });
  if (!row || row.status !== "PENDING") return;

  await prisma.messageLog.update({
    where: { id },
    data: { nextAttemptAt: new Date() }
  });

  try {
    await processOutbox({ limit: 100 });
  } catch (err) {
    // best-effort
  }
}
