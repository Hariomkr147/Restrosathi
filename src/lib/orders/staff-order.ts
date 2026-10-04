import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { getOrOpenTableSession, openTakeawaySession, lockSession } from "../sessions";
import { audit } from "../audit";
import { PlacementError, prepareOrderLines } from "./place";
import { placeOrderInput } from "./schemas";

export const staffOrderInput = z.object({
  target: z.discriminatedUnion("type", [
    z.object({ type: z.literal("TABLE"), tableId: z.string().min(1) }),
    z.object({ type: z.literal("TAKEAWAY"), customerName: z.string().trim().max(60).optional(), sessionId: z.string().min(1).optional() }),
  ]),
  idempotencyKey: z.uuid(),
  items: placeOrderInput.shape.items,
});

export type StaffOrderResult = { ok: true; orderId: string; sessionId: string; duplicate?: boolean } | { ok: false; error: "TABLE_NOT_FOUND" | "ITEM_UNAVAILABLE" | "CHOICE_INVALID" | "INVALID_INPUT" | "SESSION_CLOSED"; itemId?: string };

export async function createStaffOrder(input: unknown, actorId: string): Promise<StaffOrderResult> {
  const parsed = staffOrderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const data = parsed.data;

  const existing = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
  if (existing) return { ok: true, orderId: existing.id, sessionId: existing.sessionId, duplicate: true };

  try {
    return await prisma.$transaction(async (tx): Promise<StaffOrderResult> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('order:' || ${data.idempotencyKey}, 0))`;
      const duplicate = await tx.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (duplicate) return { ok: true, orderId: duplicate.id, sessionId: duplicate.sessionId, duplicate: true };

      const menu = await tx.menuItem.findMany({ where: { id: { in: data.items.map(({ itemId }) => itemId) } },
        include: { variants: true, modifierGroups: { include: { options: true } } } });

      const lines = prepareOrderLines(menu, data.items);

      let session;
      if (data.target.type === "TABLE") {
        const table = await tx.restaurantTable.findFirst({ where: { id: data.target.tableId, active: true } });
        if (!table) throw new PlacementError("TABLE_NOT_FOUND");
        session = await getOrOpenTableSession(tx, table.id);
      } else {
        if (data.target.sessionId) {
          session = await tx.diningSession.findUnique({ where: { id: data.target.sessionId } });
          if (!session) throw new PlacementError("TABLE_NOT_FOUND");
          if (session.status === "CLOSED") return { ok: false, error: "SESSION_CLOSED" };
          await lockSession(tx, session);
        } else {
          session = await openTakeawaySession(tx, { customerName: data.target.customerName });
        }
      }

      const now = new Date();
      const order = await tx.order.create({
        data: {
          sessionId: session.id,
          idempotencyKey: data.idempotencyKey,
          source: "STAFF",
          status: "PREPARING",
          placedAt: now,
          acceptedAt: now,
          customerName: data.target.type === "TAKEAWAY" ? data.target.customerName : undefined,
          lines: { create: lines }
        }
      });

      await audit({
        actorId,
        action: "order.staff_create",
        entity: "Order",
        entityId: order.id,
        data: { sessionId: session.id }
      }, tx);
      return { ok: true, orderId: order.id, sessionId: session.id };
    }, { maxWait: 20_000, timeout: 30_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
        Array.isArray(error.meta?.target) && error.meta.target.includes("idempotencyKey")) {
      const winner = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (winner) return { ok: true, orderId: winner.id, sessionId: winner.sessionId, duplicate: true };
    }
    if (error instanceof PlacementError) {
      if (error.error === "RATE_LIMITED") return { ok: false, error: "INVALID_INPUT" }; // Staff doesn't have rate limit
      return { ok: false, error: error.error as Exclude<typeof error.error, "RATE_LIMITED">, ...(error.itemId ? { itemId: error.itemId } : {}) };
    }
    throw error;
  }
}
