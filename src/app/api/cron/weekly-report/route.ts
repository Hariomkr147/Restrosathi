import { verifyCronSecret } from "@/lib/cron";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/whatsapp/notify";

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.ownerAlertPhone) {
    return NextResponse.json({ message: "No ownerAlertPhone configured." });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const bills = await prisma.bill.aggregate({
    _count: { id: true },
    _sum: { totalPaise: true },
    where: { status: "SETTLED", generatedAt: { gte: sevenDaysAgo } }
  });

  const orderCount = bills._count.id;
  const sales = `₹${((bills._sum.totalPaise || 0) / 100).toFixed(2)}`;

  const msgId = await prisma.$transaction(async (tx) => {
    const msgRes = await notify("WEEKLY_REPORT", settings.ownerAlertPhone!, {
      orderCount,
      sales
    }, { tx });
    return "id" in msgRes ? msgRes.id : undefined;
  });

  if (msgId) {
    import("@/lib/whatsapp/outbox").then(({ sendNow }) => sendNow(msgId)).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
