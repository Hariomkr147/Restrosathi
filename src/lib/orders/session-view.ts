import type { OrderStatus, ServiceKind, SessionStatus } from "@prisma/client";
import { prisma } from "../db";
import { l10nSchema } from "../i18n/schema";
import type { L10n } from "../i18n/l10n";

export type SessionView = {
  table: { label: string }; session: { status: SessionStatus } | null;
  orders: { id: string; status: OrderStatus; rejectReason: string | null; placedAt: string;
    lines: { name: L10n; variant: L10n | null; modifiers: L10n[]; qty: number; linePaise: number; note: string | null; voided: boolean }[] }[];
  openRequests: ServiceKind[]; amountPaise: number;
  bill: null | { status: "OPEN" | "SETTLED"; title: string; lines: { name: string; qty: number; totalPaise: number }[]; subtotalPaise: number; discountPaise: number; taxLines: { label: string; amountPaise: number }[]; roundOffPaise: number; totalPaise: number };
};
// Public: the active code scopes every read to its current, non-closed session.
export async function getSessionView(code: string): Promise<SessionView | null> {
  if (typeof code !== "string" || code.length !== 10) return null;
  const table = await prisma.restaurantTable.findFirst({ where: { code, active: true } });
  if (!table) return null;
  const session = await prisma.diningSession.findFirst({
    where: { tableId: table.id, status: { not: "CLOSED" } },
    include: {
      orders: { orderBy: [{ placedAt: "asc" }, { id: "asc" }], include: { lines: { orderBy: { id: "asc" } } } },
      requests: { where: { resolvedAt: null }, select: { kind: true } },
      bill: { where: { status: { in: ["OPEN", "SETTLED"] } }, include: { lines: true } }
    }
  });
  if (!session) return { table: { label: table.label }, session: null, orders: [], openRequests: [], amountPaise: 0, bill: null };
  const orders = session.orders.map((order) => ({ id: order.id, status: order.status, rejectReason: order.rejectReason, placedAt: order.placedAt.toISOString(),
    lines: order.lines.map((line) => ({ name: l10nSchema.parse(line.nameSnapshot), variant: line.variantSnapshot === null ? null : l10nSchema.parse(line.variantSnapshot),
      modifiers: (line.modifiersSnapshot as unknown[]).map((name) => l10nSchema.parse(name)), qty: line.qty,
      linePaise: line.qty * line.unitPricePaise, note: line.note, voided: line.voidedAt !== null })) }));
  
  let bill = null;
  const dbBill = session.bill;
  if (dbBill && (dbBill.status === "OPEN" || dbBill.status === "SETTLED")) {
    const taxLines: { label: string; amountPaise: number }[] = [];
    if (dbBill.taxMode === "REGULAR") {
      taxLines.push({ label: `CGST ${dbBill.gstRatePercent / 2}%`, amountPaise: dbBill.cgstPaise });
      taxLines.push({ label: `SGST ${dbBill.gstRatePercent / 2}%`, amountPaise: dbBill.sgstPaise });
    }
    bill = {
      status: dbBill.status as "OPEN" | "SETTLED",
      title: dbBill.taxMode === "REGULAR" ? "Tax Invoice" : "Bill",
      lines: dbBill.lines.map((l: any) => ({ name: l.name.en || l.name, qty: l.qty, totalPaise: l.linePaise })),
      subtotalPaise: dbBill.subtotalPaise,
      discountPaise: dbBill.discountPaise,
      taxLines,
      roundOffPaise: dbBill.roundOffPaise,
      totalPaise: dbBill.totalPaise
    };
  }

  return { table: { label: table.label }, session: { status: session.status }, orders, openRequests: session.requests.map(({ kind }) => kind),
    amountPaise: orders.filter(({ status }) => status !== "REJECTED").reduce((total, order) => total + order.lines.filter(({ voided }) => !voided).reduce((sum, line) => sum + line.linePaise, 0), 0),
    bill 
  };
}
