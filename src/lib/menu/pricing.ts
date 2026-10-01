export type PricingItem = {
  basePricePaise: number | null;
  variants: { id: string; pricePaise: number }[];
  modifierGroups: { id: string; min: number; max: number; options: { id: string; priceDeltaPaise: number }[] }[];
};

export class MenuChoiceError extends Error {
  constructor(public readonly code: "VARIANT_REQUIRED" | "UNKNOWN_VARIANT" | "UNKNOWN_OPTION" | "GROUP_MIN" | "GROUP_MAX") {
    super(code); this.name = "MenuChoiceError";
  }
}

export function priceLine(item: PricingItem, choice: { variantId?: string; optionIds: string[] }): number {
  if (item.variants.length && !choice.variantId) throw new MenuChoiceError("VARIANT_REQUIRED");
  const variant = item.variants.find((entry) => entry.id === choice.variantId);
  if (choice.variantId !== undefined && !variant) throw new MenuChoiceError("UNKNOWN_VARIANT");
  let price = variant?.pricePaise ?? item.basePricePaise;
  if (price === null) throw new MenuChoiceError("VARIANT_REQUIRED");
  const selected = new Set(choice.optionIds);
  const options = item.modifierGroups.flatMap((group) => group.options);
  for (const id of selected) {
    const option = options.find((entry) => entry.id === id);
    if (!option) throw new MenuChoiceError("UNKNOWN_OPTION");
    price += option.priceDeltaPaise;
  }
  for (const group of item.modifierGroups) {
    const count = group.options.filter((option) => selected.has(option.id)).length;
    if (count < group.min) throw new MenuChoiceError("GROUP_MIN");
    if (count > group.max) throw new MenuChoiceError("GROUP_MAX");
  }
  return price;
}
