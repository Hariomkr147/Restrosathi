import { expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { canTransition } from "./state";

const states: OrderStatus[] = ["NEW", "PREPARING", "READY", "SERVED", "REJECTED"];
const allowed = ["NEW:PREPARING", "NEW:REJECTED", "PREPARING:READY", "READY:SERVED"];
it.each(states.flatMap((from) => states.map((to) => [from, to] as const)))("%s → %s follows the canonical state machine", (from, to) => {
  expect(canTransition(from, to)).toBe(allowed.includes(`${from}:${to}`));
});
