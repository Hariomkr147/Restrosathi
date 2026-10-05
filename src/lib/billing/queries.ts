import { prisma } from "../db";
import { getSettings } from "../settings";
import { computeBill } from "./calc";

export async function getBillData(sessionId: string) {
  const session = await prisma.diningSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      orders: {
        where: { status: { not: "REJECTED" } },
        include: { lines: { where: { voidedAt: null } } }
      },
      bill: { include: { lines: true } }
    }
  });

  if (!session) return null;

  const validLines = session.orders.flatMap(o => o.lines);
  const settings = await getSettings();

  const calcLines = validLines.map(l => ({
    qty: l.qty,
    unitPricePaise: l.unitPricePaise
  }));

  const computed = computeBill({
    lines: calcLines,
    discount: session.bill?.discountType ? { 
      type: session.bill.discountType as "FLAT" | "PERCENT", 
      valuePaise: session.bill.discountType === "FLAT" ? session.bill.discountValue! : 0, 
      percent: session.bill.discountType === "PERCENT" ? session.bill.discountValue! : 0 
    } : undefined,
    taxMode: settings.taxMode,
    gstRatePercent: settings.gstRatePercent,
    pricesIncludeTax: settings.pricesIncludeTax
  });

  return { session, settings, computed, validLines };
}
