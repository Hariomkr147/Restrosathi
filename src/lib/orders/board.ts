import { requireUser } from "../auth/session";
import { prisma as db } from "../db";
import { getLocale } from "next-intl/server";
import { localize, type Locale, type L10n } from "../i18n/l10n";

export type BoardOrder = {
  id: string;
  tableLabel: string | "Takeaway";
  status: "NEW" | "PREPARING" | "READY" | "SERVED" | "REJECTED";
  placedAt: Date;
  acceptedAt?: Date | null;
  readyAt?: Date | null;
  servedAt?: Date | null;
  customerName?: string | null;
  lines: Array<{
    id: string;
    name: string;
    variant?: string | null;
    modifiers: string[];
    qty: number;
    note?: string | null;
    voided: boolean;
  }>;
};

export type BoardRequest = {
  id: string;
  tableLabel: string;
  kind: "CALL_WAITER" | "REQUEST_BILL";
  createdAt: Date;
};

export async function getBoard(): Promise<{ now: string; orders: BoardOrder[]; requests: BoardRequest[] }> {
  await requireUser();
  const locale = await getLocale() as Locale;
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const [orders, requests] = await Promise.all([
    db.order.findMany({
      where: {
        OR: [
          { status: { in: ["NEW", "PREPARING", "READY"] } },
          { status: "SERVED", servedAt: { gte: twoHoursAgo } }
        ]
      },
      include: {
        session: { include: { table: { select: { label: true } } } },
        lines: {
          orderBy: { id: "asc" }
        }
      },
      orderBy: { placedAt: "asc" }
    }),
    db.serviceRequest.findMany({
      where: { resolvedAt: null },
      include: { session: { include: { table: { select: { label: true } } } } },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    now: now.toISOString(),
    orders: orders.map(o => ({
      id: o.id,
      tableLabel: o.session?.table?.label ?? "Takeaway",
      status: o.status,
      placedAt: o.placedAt,
      acceptedAt: o.acceptedAt,
      readyAt: o.readyAt,
      servedAt: o.servedAt,
      customerName: o.customerName,
      lines: o.lines.map(l => ({
        id: l.id,
        name: localize(l.nameSnapshot as L10n, locale),
        variant: l.variantSnapshot ? localize(l.variantSnapshot as L10n, locale) : null,
        modifiers: (l.modifiersSnapshot as unknown[]).map(m => localize(m as L10n, locale)),
        qty: l.qty,
        note: l.note,
        voided: l.voidedAt !== null
      }))
    })),
    requests: requests.map(r => ({
      id: r.id,
      tableLabel: r.session?.table?.label ?? "Takeaway",
      kind: r.kind,
      createdAt: r.createdAt
    }))
  };
}

export async function resolveServiceRequest(id: string) {
  const user = await requireUser();
  const request = await db.serviceRequest.findUnique({ where: { id } });
  if (!request || request.resolvedAt) return { ok: true };
  
  await db.$transaction([
    db.serviceRequest.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedById: user.id }
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: "request.resolve",
        entity: "ServiceRequest",
        entityId: id,
        data: { kind: request.kind }
      }
    })
  ]);
  return { ok: true };
}
