import type { OrderStatus } from "@prisma/client";

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PREPARING", "REJECTED"], PREPARING: ["READY"], READY: ["SERVED"], SERVED: [], REJECTED: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
