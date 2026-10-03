import { requireUser } from "../auth/session";
import { prisma as db } from "../db";

export type KotData = {
  restaurantName: string;
  tableLabel: string | "Takeaway";
  orderNo: string;
  placedAt: string;
  customerName?: string | null;
  lines: Array<{
    qty: number;
    name: string;
    variant?: string | null;
    modifiers: string[];
    note?: string | null;
  }>;
};

export async function getKot(orderId: string, lang: "en" | "hi" = "en"): Promise<KotData | null> {
  await requireUser();

  const [settings, order] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.order.findUnique({
      where: { id: orderId, status: { not: "REJECTED" } },
      include: {
        session: { include: { table: true } },
        lines: { where: { voidedAt: null } }
      }
    })
  ]);

  if (!order || !settings) return null;

  return {
    restaurantName: settings.name,
    tableLabel: order.session?.table?.label ?? "Takeaway",
    orderNo: order.id.slice(-4).toUpperCase(),
    placedAt: order.placedAt.toISOString(),
    customerName: order.customerName,
    lines: order.lines.map((l) => {
      const nameObj = l.nameSnapshot as Record<string, string>;
      const varObj = l.variantSnapshot as Record<string, string> | null;
      const modArr = l.modifiersSnapshot as Array<Record<string, string>>;

      return {
        qty: l.qty,
        name: nameObj?.[lang] || nameObj?.en || "",
        variant: varObj ? (varObj[lang] || varObj.en) : null,
        modifiers: modArr.map((m) => m[lang] || m.en).filter(Boolean),
        note: l.note
      };
    })
  };
}
