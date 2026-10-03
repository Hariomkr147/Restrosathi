import { expect, it } from "vitest";
import { cartReducer, cartCount, type CartLine } from "./cart";

const line: CartLine = { itemId: "dish", variantId: "full", optionIds: ["cheese", "butter"], qty: 1, note: "Less salt" };
it("merges identical choices regardless of option order", () => {
  const first = cartReducer([], { type: "add", line });
  const merged = cartReducer(first, { type: "add", line: { ...line, optionIds: ["butter", "cheese"], qty: 2 } });
  expect(merged).toHaveLength(1); expect(merged[0].qty).toBe(3); expect(cartCount(merged)).toBe(3);
});
it("different notes, variants or modifiers remain separate", () => {
  let state = cartReducer([], { type: "add", line });
  for (const change of [{ note: "No salt" }, { variantId: "half" }, { optionIds: ["cheese"] }]) state = cartReducer(state, { type: "add", line: { ...line, ...change } });
  expect(state).toHaveLength(4);
});
it("quantity is bounded to1–20 and cannot become fractional or NaN", () => {
  const state = cartReducer([], { type: "add", line });
  expect(cartReducer(state, { type: "setQty", index: 0, qty: 20 })[0].qty).toBe(20);
  for (const qty of [0, 21, 1.5, NaN]) expect(cartReducer(state, { type: "setQty", index: 0, qty })).toEqual(state);
  expect(cartReducer(state, { type: "add", line: { ...line, qty: 20 } })[0].qty).toBeLessThanOrEqual(20);
});
it("remove and clear update the count", () => {
  const state = cartReducer([], { type: "add", line });
  expect(cartReducer(state, { type: "remove", index: 0 })).toEqual([]);
  expect(cartReducer(state, { type: "clear" })).toEqual([]);
  expect(cartCount([])).toBe(0);
});
