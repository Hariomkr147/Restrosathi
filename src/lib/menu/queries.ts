import { prisma } from "../db";
import { l10nSchema, type L10n } from "../i18n/l10n";
import { itemInputSchema, type ItemInput } from "./schemas";

export type PublicItem = Omit<ItemInput, "basePricePaise" | "description" | "variants" | "modifierGroups"> & {
  id: string; basePricePaise: number | null; description: L10n | null; photoUrl: string | null; sortOrder: number;
  variants: (ItemInput["variants"][number] & { id: string; sortOrder: number })[];
  modifierGroups: (Omit<ItemInput["modifierGroups"][number], "options"> & {
    id: string; sortOrder: number;
    options: (ItemInput["modifierGroups"][number]["options"][number] & { id: string; sortOrder: number })[];
  })[];
};
export type PublicMenu = { categories: { id: string; name: L10n; items: PublicItem[] }[] };

export async function getPublicMenu(): Promise<PublicMenu> {
  const categories = await prisma.category.findMany({
    where: { items: { some: {} } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { items: {
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        variants: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        modifierGroups: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
      },
    } },
  });
  return { categories: categories.map((category) => ({
    id: category.id, name: l10nSchema.parse(category.name),
    items: category.items.map((item) => {
      const view = {
        ...item, name: l10nSchema.parse(item.name), description: item.description === null ? null : l10nSchema.parse(item.description),
        variants: item.variants.map((variant) => ({ ...variant, name: l10nSchema.parse(variant.name) })),
        modifierGroups: item.modifierGroups.map((group) => ({
          ...group, name: l10nSchema.parse(group.name),
          options: group.options.map((option) => ({ ...option, name: l10nSchema.parse(option.name) })),
        })),
      };
      itemInputSchema.parse({ ...view, basePricePaise: view.basePricePaise ?? undefined, description: view.description ?? undefined });
      return view;
    }),
  })) };
}
