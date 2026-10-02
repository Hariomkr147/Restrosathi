"use server";

import { AuthError, requireUser } from "@/lib/auth/session";
import * as transitions from "@/lib/orders/transitions";

async function mutate(operation: (actorId: string) => ReturnType<typeof transitions.acceptOrder>) {
  try { const user = await requireUser(); return await operation(user.id); }
  catch (error) {
    if (error instanceof AuthError) return { ok: false as const, error: "FORBIDDEN" as const };
    throw error;
  }
}
export async function acceptOrder(orderId: string) { return mutate((actorId) => transitions.acceptOrder(orderId, actorId)); }
export async function rejectOrder(orderId: string, reason: string) { return mutate((actorId) => transitions.rejectOrder(orderId, reason, actorId)); }
export async function markReady(orderId: string) { return mutate((actorId) => transitions.markReady(orderId, actorId)); }
export async function markServed(orderId: string) { return mutate((actorId) => transitions.markServed(orderId, actorId)); }
export async function voidLine(lineId: string, reason: string) { return mutate((actorId) => transitions.voidLine(lineId, reason, actorId)); }
