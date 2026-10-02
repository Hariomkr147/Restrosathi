import { z } from "zod";
import { l10nSchema } from "../i18n/schema";

const price = z.number().int().positive().max(2147483647);
const modifierGroup = z.object({
  name: l10nSchema,
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative().max(2147483647),
  options: z.array(z.object({ name: l10nSchema, priceDeltaPaise: z.number().int().nonnegative().max(2147483647) })).min(1),
}).refine((group) => group.max >= group.min, { path: ["max"], message: "Maximum must be at least the minimum." })
  .refine((group) => group.min <= group.options.length, { path: ["min"], message: "Minimum cannot exceed the available options." });

export const itemInputSchema = z.object({
  categoryId: z.string().min(1),
  name: l10nSchema,
  description: l10nSchema.optional(),
  basePricePaise: price.optional(),
  variants: z.array(z.object({ name: l10nSchema, pricePaise: price })),
  modifierGroups: z.array(modifierGroup),
  isVeg: z.boolean(),
  spiceLevel: z.number().int().min(0).max(3),
  tags: z.array(z.enum(["BESTSELLER", "CHEFS_SPECIAL", "NEW"])),
  available: z.boolean(),
}).refine((item) => (item.basePricePaise !== undefined) !== (item.variants.length > 0), {
  path: ["basePricePaise"], message: "Choose either a base price or variants.",
});

export type ItemInput = z.infer<typeof itemInputSchema>;
