import { expect, it } from "vitest";
import { placeOrderInput } from "./schemas";

const line = { itemId: "dish", optionIds: [], qty: 1 };
const input = { tableCode: "TESTCODE01", idempotencyKey: "4a9e2079-ef05-43e0-85ec-57702337d397", items: [line] };
it.each([0, 21, 1.5])("rejects quantity %s", (qty) => {
  expect(placeOrderInput.safeParse({ ...input, items: [{ ...line, qty }] }).success).toBe(false);
});
it("bounds lines, notes, names, ids and options", () => {
  for (const bad of [
    { items: [] }, { items: Array(31).fill(line) }, { items: [{ ...line, note: "x".repeat(201) }] },
    { customerName: "x".repeat(61) }, { tableCode: "" }, { idempotencyKey: "not-a-uuid" },
    { items: [{ ...line, itemId: "" }] }, { items: [{ ...line, optionIds: Array(101).fill("option") }] },
  ]) expect(placeOrderInput.safeParse({ ...input, ...bad }).success).toBe(false);
});
it("strips a client-sent price while retaining valid choices", () => {
  const parsed = placeOrderInput.parse({ ...input, items: [{ ...line, unitPricePaise: 1 }] });
  expect(parsed.items[0]).toEqual(line);
});
