import { verifyCronSecret } from "@/lib/cron";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/whatsapp/notify";
import { generateWeeklyReport } from "@/lib/reports/weekly";
import { formatINR } from "@/lib/money/format";

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.ownerAlertPhone) {
    return NextResponse.json({ message: "No ownerAlertPhone configured." });
  }

  // Monday after 09:00 IST logic
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istNow = new Date(istString);
  const isMonday = istNow.getDay() === 1;
  const isPast9AM = istNow.getHours() >= 9;

  if (!isMonday || !isPast9AM) {
    return NextResponse.json({ message: "Not Monday after 09:00 IST" });
  }

  const log = await generateWeeklyReport(now);

  if (!log) {
    return NextResponse.json({ message: "Report already generated for this week." });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = log.content as any;
  const startAt = new Date(content.startAt);
  const endAt = new Date(content.endAt);

  // Format dates for display
  const toDisplayDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const startStr = toDisplayDate(startAt);
  const endStr = toDisplayDate(endAt);

  const sales = formatINR(content.revenuePaise);
  const locale = settings.ownerReportLocale as "en" | "hi";

  const msgId = await prisma.$transaction(async (tx) => {
    const msgRes = await notify("WEEKLY_REPORT", settings.ownerAlertPhone!, {
      start: startStr,
      end: endStr,
      orderCount: content.orderCount,
      sales,
      insight: content.insight || ""
    }, { tx, locale });
    return "id" in msgRes ? msgRes.id : undefined;
  });

  if (msgId) {
    import("@/lib/whatsapp/outbox").then(({ sendNow }) => sendNow(msgId)).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
