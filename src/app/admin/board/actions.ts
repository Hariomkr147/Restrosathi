"use server";
import { requireUser } from "@/lib/auth/session";
import { prisma as db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function acceptOrder(id: string) {
  await requireUser();
  await db.order.update({ where: { id, status: "NEW" }, data: { status: "PREPARING", acceptedAt: new Date() } });
}

export async function readyOrder(id: string) {
  await requireUser();
  await db.order.update({ where: { id, status: { in: ["NEW", "PREPARING"] } }, data: { status: "READY", readyAt: new Date() } });
}

export async function serveOrder(id: string) {
  await requireUser();
  await db.order.update({ where: { id, status: "READY" }, data: { status: "SERVED", servedAt: new Date() } });
}

export async function rejectOrder(id: string, reason: string) {
  await requireUser();
  await db.order.update({ where: { id, status: "NEW" }, data: { status: "REJECTED", rejectedAt: new Date(), rejectReason: reason } });
}

export async function voidLine(id: string, reason: string) {
  const user = await requireUser();
  await db.orderLine.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason, voidedById: user.id } });
}

export async function resolveRequest(id: string) {
  const user = await requireUser();
  const request = await db.serviceRequest.findUnique({ where: { id } });
  if (!request || request.resolvedAt) return;
  await db.$transaction([
    db.serviceRequest.update({ where: { id }, data: { resolvedAt: new Date(), resolvedById: user.id } }),
    db.auditLog.create({ data: { actorId: user.id, action: "request.resolve", entity: "ServiceRequest", entityId: id, data: { kind: request.kind } } })
  ]);
}
