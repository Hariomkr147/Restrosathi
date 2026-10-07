import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runChecks } from "@/lib/monitoring/checks";
import { internalSendSystemAlert } from "@/lib/whatsapp/notify";
import { reportError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const now = new Date();
    const results = await runChecks(now);

    const failing = results.filter(r => !r.ok);
    const systemDownAlert = await prisma.alertState.findUnique({ where: { key: "system_down" } });

    if (failing.length === 0) {
      if (systemDownAlert && systemDownAlert.active) {
        await prisma.alertState.update({
          where: { key: "system_down" },
          data: { active: false }
        });
        
        if (settings?.ownerAlertPhone) {
          try {
             await internalSendSystemAlert(settings.ownerAlertPhone, "RestroSathi: System recovered. All checks passing.");
          } catch (e) {
             reportError(e instanceof Error ? e : new Error(String(e)), "alerts-recovery");
          }
        }
      }
    } else {
      const hoursSinceLastAlert = systemDownAlert?.lastSentAt 
        ? (now.getTime() - systemDownAlert.lastSentAt.getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (!systemDownAlert?.active || hoursSinceLastAlert > 4) {
        await prisma.alertState.upsert({
          where: { key: "system_down" },
          update: { active: true, lastSentAt: now },
          create: { key: "system_down", active: true, lastSentAt: now }
        });

        if (settings?.ownerAlertPhone) {
          const lines = failing.map(f => `- ${f.key}: ${f.detail}`);
          const message = `RestroSathi System Alert:\n${lines.join("\n")}`;
          try {
             await internalSendSystemAlert(settings.ownerAlertPhone, message);
          } catch (e) {
             reportError(e instanceof Error ? e : new Error(String(e)), "alerts-failure");
          }
        }
      }
    }

    return NextResponse.json({ ok: true, failing: failing.length, results });
  } catch (error) {
    reportError(error instanceof Error ? error : new Error(String(error)), "alerts-cron");
    return NextResponse.json({ ok: false, error: "Alert loop failed" }, { status: 500 });
  }
}
