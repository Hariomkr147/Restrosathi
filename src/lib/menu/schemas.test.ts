import { expect, it } from "vitest";
import { itemInputSchema } from "./schemas";

const naanInput = {
  categoryId: "breads", name: { en: "Butter Naan", hi: "बटर नान" }, basePricePaise: 6000,
  variants: [], modifierGroups: [], isVeg: true, spiceLevel: 0, tags: [], available: true,
};
const noPrice = { ...naanInput, basePricePaise: undefined };
const both = { ...naanInput, variants: [{ name: { en: "Half" }, pricePaise: 3000 }] };

it("accepts a base price and missing Hindi", () => expect(itemInputSchema.safeParse({ ...naanInput, name: { en: "Butter Naan" } }).success).toBe(true));
it("accepts variants instead of a base price", () => expect(itemInputSchema.safeParse({ ...both, basePricePaise: undefined }).success).toBe(true));
it("rejects an item with neither base price nor variants", () => expect(itemInputSchema.safeParse(noPrice).success).toBe(false));
it("rejects an item with both", () => expect(itemInputSchema.safeParse(both).success).toBe(false));
it("rejects zero price", () => expect(itemInputSchema.safeParse({ ...naanInput, basePricePaise: 0 }).success).toBe(false));
it.each([
  { basePricePaise: 10.5 }, { categoryId: "" }, { name: { en: " " } }, { spiceLevel: 4 }, { spiceLevel: 0.5 }, { tags: ["UNKNOWN"] },
  { variants: [{ name: { en: "Half" }, pricePaise: -1 }], basePricePaise: undefined },
])("rejects malformed item fields %j", (fields) => expect(itemInputSchema.safeParse({ ...naanInput, ...fields }).success).toBe(false));
it.each([
  { min: -1, max: 1, options: [{ name: { en: "Butter" }, priceDeltaPaise: 0 }] },
  { min: 2, max: 1, options: [{ name: { en: "Butter" }, priceDeltaPaise: 0 }] },
  { min: 0, max: 1, options: [] },
  { min: 0, max: 1, options: [{ name: { en: "Butter" }, priceDeltaPaise: -1 }] },
])("rejects malformed modifier groups %j", (group) =>
  expect(itemInputSchema.safeParse({ ...naanInput, modifierGroups: [{ name: { en: "Extras" }, ...group }] }).success).toBe(false));
