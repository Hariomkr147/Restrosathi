import { expect, test } from "vitest";
import { newOrderIds, escalationLevel, staleness, announce } from "./board-logic";
import type { BoardOrder } from "./board";

const baseOrder: BoardOrder = {
  id: "1", tableLabel: "T1", status: "NEW", placedAt: new Date(), lines: []
};

test("newOrderIds finds only unseen ids", () => {
  expect(newOrderIds([], [baseOrder])).toEqual(["1"]);
  expect(newOrderIds([baseOrder], [baseOrder, { ...baseOrder, id: "2" }])).toEqual(["2"]);
  expect(newOrderIds([baseOrder], [baseOrder])).toEqual([]);
});

test("escalationLevel is 0 at 119s and 1 at 121s for NEW, always 0 for others", () => {
  const placedAt = new Date(1000000);
  expect(escalationLevel({ ...baseOrder, placedAt }, 1000000 + 119000)).toBe(0);
  expect(escalationLevel({ ...baseOrder, placedAt }, 1000000 + 121000)).toBe(1);
  expect(escalationLevel({ ...baseOrder, status: "PREPARING", placedAt }, 1000000 + 121000)).toBe(0);
});

test("staleness boundary at 15s", () => {
  expect(staleness(1000000, 1000000 + 14000)).toBe("ok");
  expect(staleness(1000000, 1000000 + 16000)).toBe("stale");
});

test("announce text formats singular and plural orders and requests", () => {
  const t = {
    newOrder1: "1 new order",
    newOrderN: "{n} new orders",
    newRequest1: "1 new request",
    newRequestN: "{n} new requests"
  };
  expect(announce(1, 0, t)).toBe("1 new order");
  expect(announce(2, 0, t)).toBe("2 new orders");
  expect(announce(0, 1, t)).toBe("1 new request");
  expect(announce(0, 2, t)).toBe("2 new requests");
  expect(announce(1, 1, t)).toBe("1 new order. 1 new request");
  expect(announce(0, 0, t)).toBe("");
});
