import type { BoardOrder } from "./board";

export function newOrderIds(prev: BoardOrder[], next: BoardOrder[]): string[] {
  const prevIds = new Set(prev.map(o => o.id));
  return next.map(o => o.id).filter(id => !prevIds.has(id));
}

export function escalationLevel(order: BoardOrder, nowMs: number): 0 | 1 {
  if (order.status !== "NEW") return 0;
  return nowMs - order.placedAt.getTime() > 120_000 ? 1 : 0;
}

export function staleness(lastOkMs: number, nowMs: number): "ok" | "stale" {
  return nowMs - lastOkMs > 15_000 ? "stale" : "ok";
}

export function announce(newOrders: number, newRequests: number, t: Record<string, string>): string {
  const parts = [];
  if (newOrders === 1) parts.push(t.newOrder1);
  else if (newOrders > 1) parts.push(t.newOrderN.replace("{n}", String(newOrders)));
  
  if (newRequests === 1) parts.push(t.newRequest1);
  else if (newRequests > 1) parts.push(t.newRequestN.replace("{n}", String(newRequests)));
  
  return parts.join(". ");
}
