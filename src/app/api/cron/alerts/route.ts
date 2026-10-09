import { verifyCronSecret } from "@/lib/cron";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runChecks } from "@/lib/monitoring/checks";
import { notify } from "@/lib/whatsapp/notify";
import { reportError } from "@/lib/errors";

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const now = new Date();
    // 1. run the checks
    const results = await runChecks(now);
    let failingCount = 0;

    // 2. serialize evaluation to avoid race conditions
    await prisma.$transaction(async (tx) => {
      // 505 for alerts serialization lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(505)`;
      
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      const ownerPhone = settings?.ownerAlertPhone;

      for (const res of results) {
        if (!res.ok) failingCount++;
        
        let state = await tx.alertState.findUnique({ where: { key: res.key } });
        if (!state) {
          state = await tx.alertState.create({
            data: { key: res.key, active: false, lastSentAt: null, firstFailedAt: null }
          });
        }

        if (!res.ok) {
          // Failure path
          const hoursSinceLastAlert = state.lastSentAt
            ? (now.getTime() - state.lastSentAt.getTime()) / (1000 * 60 * 60)
            : Infinity;

          if (!state.active || hoursSinceLastAlert >= 6) {
            // First failure or repeat after 6 hours
            await tx.alertState.update({
              where: { key: res.key },
              data: { 
                active: true, 
                lastSentAt: now,
                firstFailedAt: state.active ? state.firstFailedAt : now
              }
            });

            if (ownerPhone) {
              const msg = `RestroSathi Alert: ${res.key} failed. Detail: ${res.detail}`;
              await notify("SYSTEM_ALERT", ownerPhone, { message: msg }, { tx });
            }
          }
        } else {
          // Success path
          if (state.active) {
            // One recovery
            await tx.alertState.update({
              where: { key: res.key },
              data: { active: false }
            });

            if (ownerPhone) {
              const msg = `RestroSathi Recovery: ${res.key} is ok.`;
              await notify("SYSTEM_ALERT", ownerPhone, { message: msg }, { tx });
            }
          }
        }
      }
    });

    return NextResponse.json({ ok: true, failing: failingCount, results });
  } catch (error) {
    reportError(error instanceof Error ? error : new Error(String(error)), "alerts-cron");
    return NextResponse.json({ ok: false, error: "Alert loop failed" }, { status: 500 });
  }
}
