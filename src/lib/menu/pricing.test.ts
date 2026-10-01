import { expect, it } from "vitest";
import { priceLine, type PricingItem } from "./pricing";

const dal: PricingItem = {
  basePricePaise: null, variants: [{ id: "half", pricePaise: 18000 }, { id: "full", pricePaise: 32000 }], modifierGroups: [],
};
const naan: PricingItem = {
  basePricePaise: 6000, variants: [],
  modifierGroups: [{ id: "extras", min: 0, max: 2, options: [{ id: "butter", priceDeltaPaise: 1000 }, { id: "cheese", priceDeltaPaise: 3000 }] }],
};
const tikka: PricingItem = {
  basePricePaise: 28000, variants: [],
  modifierGroups: [{ id: "spice", min: 1, max: 1, options: [{ id: "mild", priceDeltaPaise: 0 }, { id: "hot", priceDeltaPaise: 0 }] }],
};

it("uses base price", () => expect(priceLine(naan, { optionIds: [] })).toBe(6000));
it("adds option deltas", () => expect(priceLine(naan, { optionIds: ["butter", "cheese"] })).toBe(10000));
it("uses variant price", () => expect(priceLine(dal, { variantId: "half", optionIds: [] })).toBe(18000));
it("requires a variant when the item has variants", () =>
  expect(() => priceLine(dal, { optionIds: [] })).toThrow(expect.objectContaining({ code: "VARIANT_REQUIRED" })));
it("rejects an unknown variant", () =>
  expect(() => priceLine(dal, { variantId: "other", optionIds: [] })).toThrow(expect.objectContaining({ code: "UNKNOWN_VARIANT" })));
it("rejects a variant on a base-price item", () =>
  expect(() => priceLine(naan, { variantId: "half", optionIds: [] })).toThrow(expect.objectContaining({ code: "UNKNOWN_VARIANT" })));
it("enforces group min", () =>
  expect(() => priceLine(tikka, { optionIds: [] })).toThrow(expect.objectContaining({ code: "GROUP_MIN" })));
it("enforces group max", () =>
  expect(() => priceLine(tikka, { optionIds: ["mild", "hot"] })).toThrow(expect.objectContaining({ code: "GROUP_MAX" })));
it("rejects options from another item", () =>
  expect(() => priceLine(naan, { optionIds: ["mild"] })).toThrow(expect.objectContaining({ code: "UNKNOWN_OPTION" })));
it("ignores client prices and counts each chosen option once", () => {
  const choice = { optionIds: ["butter", "butter"], unitPricePaise: 1 };
  expect(priceLine(naan, choice)).toBe(7000);
});
it("adds options to the selected variant", () =>
  expect(priceLine({ ...dal, modifierGroups: naan.modifierGroups }, { variantId: "full", optionIds: ["cheese"] })).toBe(35000));
