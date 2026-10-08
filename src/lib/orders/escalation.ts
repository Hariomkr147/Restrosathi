import { prisma } from "../db";
import { notify } from "../whatsapp/notify";

export async function escalateStaleOrders({ now = new Date(), thresholdMs = 120_000 }: { now?: Date, thresholdMs?: number } = {}): Promise<{ escalated: number }> {
  const settings = await prisma.settings.findFirst();
  const alertPhone = settings?.ownerAlertPhone;
  if (!alertPhone) return { escalated: 0 };

  const thresholdDate = new Date(now.getTime() - thresholdMs);
  let escalatedCount = 0;

  const msgId = await prisma.$transaction(async (tx) => {
    const orders = await tx.$queryRaw`
      SELECT id, "placedAt", "sessionId"
      FROM "Order"
      WHERE status = 'NEW'::"OrderStatus" 
        AND "placedAt" <= ${thresholdDate}
        AND "escalatedAt" IS NULL
      FOR UPDATE SKIP LOCKED
    ` as { id: string, placedAt: Date, sessionId: string }[];

    if (orders.length === 0) return;

    const msgs: string[] = [];
    const escalatedIds: string[] = [];

    for (const order of orders) {
      escalatedIds.push(order.id);
      
      const session = await tx.diningSession.findUnique({ where: { id: order.sessionId } });
      const table = session?.tableId ? await tx.restaurantTable.findUnique({ where: { id: session.tableId } }) : null;
      
      const waitMin = Math.round((now.getTime() - new Date(order.placedAt).getTime()) / 60000);
      const tableName = table?.label || "Unknown";
      msgs.push(`Table ${tableName} (${waitMin} min)`);
    }

    await tx.order.updateMany({
      where: { id: { in: escalatedIds } },
      data: { escalatedAt: now }
    });
    
    const text = `${escalatedIds.length} orders waiting: ${msgs.join(", ")}`;
    const msgRes = await notify("ORDER_ESCALATION", alertPhone, { label: text }, { tx: tx as import("@prisma/client").Prisma.TransactionClient });
    escalatedCount = escalatedIds.length;
    return "id" in msgRes ? msgRes.id : undefined;
  });

  if (msgId) {
    import("../whatsapp/outbox").then(({ sendNow }) => sendNow(msgId)).catch(() => {});
  }

  return { escalated: escalatedCount };
}
