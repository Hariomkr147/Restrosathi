import { prisma } from "../db";
import type { L10n } from "../i18n/l10n";
import { l10nSchema } from "../i18n/schema";
import { itemInputSchema, type ItemInput } from "./schemas";

export type PublicItem = Omit<ItemInput, "basePricePaise" | "description" | "variants" | "modifierGroups"> & {
  id: string; basePricePaise: number | null; description: L10n | null; photoUrl: string | null; sortOrder: number; pairingIds?: string[];
  variants: (ItemInput["variants"][number] & { id: string; sortOrder: number })[];
  modifierGroups: (Omit<ItemInput["modifierGroups"][number], "options"> & {
    id: string; sortOrder: number;
    options: (ItemInput["modifierGroups"][number]["options"][number] & { id: string; sortOrder: number })[];
  })[];
};
export type PublicMenu = { categories: { id: string; name: L10n; items: PublicItem[] }[] };

export async function getPublicMenu(): Promise<PublicMenu> { return readMenu(false); }
export async function getAdminMenu(): Promise<PublicMenu> { return readMenu(true); }

async function readMenu(includeEmpty: boolean): Promise<PublicMenu> {
  const categories = await prisma.category.findMany({
    where: includeEmpty ? {} : { items: { some: {} } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { items: {
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        variants: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        pairings: { orderBy: { sortOrder: "asc" }, select: { pairedItemId: true } },
        modifierGroups: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
      },
    } },
  });
  return { categories: categories.map((category) => ({
    id: category.id, name: l10nSchema.parse(category.name),
    items: category.items.map((item) => {
      const view = {
        ...item, pairingIds: item.pairings.map(({ pairedItemId }) => pairedItemId), name: l10nSchema.parse(item.name), description: item.description === null ? null : l10nSchema.parse(item.description),
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
