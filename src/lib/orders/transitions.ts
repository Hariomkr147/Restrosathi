import type { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { audit } from "../audit";
import { canTransition } from "./state";

type Result = { ok: true } | { ok: false; error: "NOT_FOUND" | "INVALID_TRANSITION" | "REASON_REQUIRED" | "BILL_LOCKED" };
const idInput = z.string().min(1).max(100);
const reasonInput = z.string().trim().min(3).max(200);

async function transition(id: string, from: OrderStatus, to: OrderStatus, actorId: string,
  action: string, data: Prisma.OrderUpdateManyMutationInput): Promise<Result> {
  if (!idInput.safeParse(id).success) return { ok: false, error: "NOT_FOUND" };
  if (!canTransition(from, to)) return { ok: false, error: "INVALID_TRANSITION" };
  return prisma.$transaction(async (tx) => {
    if (!await tx.order.findUnique({ where: { id }, select: { id: true } })) return { ok: false, error: "NOT_FOUND" };
    const changed = await tx.order.updateMany({ where: { id, status: from }, data: { ...data, status: to } });
    if (!changed.count) return { ok: false, error: "INVALID_TRANSITION" };
    await audit({ actorId, action, entity: "Order", entityId: id, data: { from, to, ...data } }, tx);
    return { ok: true };
  });
}
export function acceptOrder(orderId: string, actorId: string) {
  return transition(orderId, "NEW", "PREPARING", actorId, "order.accept", { acceptedAt: new Date().toISOString() });
}
export function rejectOrder(orderId: string, reason: string, actorId: string): Promise<Result> {
  const parsed = reasonInput.safeParse(reason);
  if (!parsed.success) return Promise.resolve({ ok: false, error: "REASON_REQUIRED" });
  return transition(orderId, "NEW", "REJECTED", actorId, "order.reject", { rejectedAt: new Date().toISOString(), rejectReason: parsed.data });
}
export function markReady(orderId: string, actorId: string) {
  return transition(orderId, "PREPARING", "READY", actorId, "order.ready", { readyAt: new Date().toISOString() });
}
export function markServed(orderId: string, actorId: string) {
  return transition(orderId, "READY", "SERVED", actorId, "order.serve", { servedAt: new Date().toISOString() });
}
export async function voidLine(lineId: string, reason: string, actorId: string): Promise<Result> {
  const parsed = reasonInput.safeParse(reason);
  if (!parsed.success) return { ok: false, error: "REASON_REQUIRED" };
  if (!idInput.safeParse(lineId).success) return { ok: false, error: "NOT_FOUND" };
  return prisma.$transaction(async (tx) => {
    const line = await tx.orderLine.findUnique({ where: { id: lineId }, select: { id: true, order: { select: { session: { select: { bill: { select: { status: true } } } } } } } });
    if (!line) return { ok: false, error: "NOT_FOUND" };
    if (line.order.session.bill && (line.order.session.bill.status === "SETTLED" || line.order.session.bill.status === "CANCELLED")) return { ok: false, error: "BILL_LOCKED" };
    const changed = await tx.orderLine.updateMany({ where: { id: lineId, voidedAt: null, order: { status: { in: ["PREPARING", "READY", "SERVED"] } } },
      data: { voidedAt: new Date(), voidReason: parsed.data, voidedById: actorId } });
    if (!changed.count) return { ok: false, error: "INVALID_TRANSITION" };
    await audit({ actorId, action: "order.void_line", entity: "OrderLine", entityId: lineId, data: { reason: parsed.data } }, tx);
    return { ok: true };
  });
}
