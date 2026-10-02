import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { audit } from "../audit";
import { l10nSchema } from "../i18n/l10n";
import { itemInputSchema } from "./schemas";
import { processMenuPhoto, UploadError } from "./images";

export class MenuEditError extends Error {
  constructor(public code: "INVALID_INPUT" | "CATEGORY_NOT_EMPTY" | "NOT_FOUND") { super(code); this.name = "MenuEditError"; }
}
const idSchema = z.string().min(1);
const categorySchema = z.object({ id: idSchema.optional(), name: l10nSchema });
const itemMetaSchema = z.object({ id: idSchema.optional(), photoUrl: z.string().regex(/^\/uploads\/menu\/[a-f0-9-]{36}\.webp$/).nullable().optional() });
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new MenuEditError("INVALID_INPUT");
  return result.data;
}

export async function upsertCategory(input: unknown) {
  await requireUser("OWNER");
  const value = validate(categorySchema, input);
  if (value.id) return prisma.category.update({ where: { id: value.id }, data: { name: value.name } });
  const maximum = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({ data: { name: value.name, sortOrder: (maximum._max.sortOrder ?? -1) + 1 } });
}
export async function deleteCategory(id: string) {
  await requireUser("OWNER"); validate(idSchema, id);
  if (await prisma.menuItem.count({ where: { categoryId: id } })) throw new MenuEditError("CATEGORY_NOT_EMPTY");
  try { await prisma.category.delete({ where: { id } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new MenuEditError("CATEGORY_NOT_EMPTY");
    throw error;
  }
}
export async function upsertItem(input: unknown) {
  const user = await requireUser("OWNER");
  const value = validate(itemInputSchema, input);
  const meta = validate(itemMetaSchema, input);
  return prisma.$transaction(async (tx) => {
    if (meta.id) await tx.$queryRaw`SELECT id FROM "MenuItem" WHERE id = ${meta.id} FOR UPDATE`;
    const before = meta.id ? await tx.menuItem.findUniqueOrThrow({ where: { id: meta.id }, include: { variants: { orderBy: { sortOrder: "asc" } }, modifierGroups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } } } }) : null;
    const { variants, modifierGroups, description, basePricePaise, ...fields } = value;
    const data = { ...fields, description: description ?? Prisma.DbNull, basePricePaise: basePricePaise ?? null, photoUrl: meta.photoUrl };
    if (meta.id) {
      await tx.menuVariant.deleteMany({ where: { itemId: meta.id } });
      await tx.modifierGroup.deleteMany({ where: { itemId: meta.id } });
    }
    const nested = {
      variants: { create: variants.map((variant, sortOrder) => ({ ...variant, sortOrder })) },
      modifierGroups: { create: modifierGroups.map(({ options, ...group }, sortOrder) => ({ ...group, sortOrder, options: { create: options.map((option, sortOrder) => ({ ...option, sortOrder })) } })) },
    };
    const maximum = meta.id ? null : await tx.menuItem.aggregate({ where: { categoryId: value.categoryId }, _max: { sortOrder: true } });
    const after = meta.id
      ? await tx.menuItem.update({ where: { id: meta.id }, data: { ...data, ...nested } })
      : await tx.menuItem.create({ data: { ...data, ...nested, sortOrder: (maximum?._max.sortOrder ?? -1) + 1 } });
    const beforePrices = before && { basePricePaise: before.basePricePaise, variants: before.variants.map((entry) => entry.pricePaise), modifiers: before.modifierGroups.map((group) => group.options.map((entry) => entry.priceDeltaPaise)) };
    const afterPrices = { basePricePaise: after.basePricePaise, variants: variants.map((entry) => entry.pricePaise), modifiers: modifierGroups.map((group) => group.options.map((entry) => entry.priceDeltaPaise)) };
    if (beforePrices && JSON.stringify(beforePrices) !== JSON.stringify(afterPrices)) {
      await audit({ actorId: user.id, action: "menu.price_change", entity: "MenuItem", entityId: after.id, data: { before: beforePrices, after: afterPrices } }, tx);
    }
    return { id: after.id };
  });
}
export async function setItemAvailability(id: string, available: boolean) {
  const user = await requireUser(); validate(idSchema, id); validate(z.boolean(), available);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MenuItem" WHERE id = ${id} FOR UPDATE`;
    const before = await tx.menuItem.findUniqueOrThrow({ where: { id } });
    await tx.menuItem.update({ where: { id }, data: { available } });
    await audit({ actorId: user.id, action: "menu.availability", entity: "MenuItem", entityId: id, data: { before: before.available, after: available } }, tx);
  });
}
export async function deleteItem(id: string) {
  await requireUser("OWNER"); validate(idSchema, id);
  await prisma.menuItem.delete({ where: { id } });
}
export async function uploadMenuPhoto(formData: FormData) {
  await requireUser("OWNER");
  const file = formData.get("photo");
  if (!(file instanceof File)) throw new UploadError("UNSUPPORTED_TYPE");
  return processMenuPhoto(file);
}
export async function reorderMenu(kind: "category" | "item", id: string, direction: "up" | "down") {
  await requireUser("OWNER"); validate(idSchema, id); validate(z.enum(["category", "item"]), kind); validate(z.enum(["up", "down"]), direction);
  await prisma.$transaction(async (tx) => {
    const orderBy = [{ sortOrder: "asc" }, { id: "asc" }] as const;
    const rows = kind === "category" ? await tx.category.findMany({ orderBy: [...orderBy] })
      : await tx.menuItem.findMany({ where: { categoryId: (await tx.menuItem.findUniqueOrThrow({ where: { id } })).categoryId }, orderBy: [...orderBy] });
    const at = rows.findIndex((entry) => entry.id === id);
    if (at < 0) throw new MenuEditError("NOT_FOUND");
    const next = at + (direction === "up" ? -1 : 1);
    if (next < 0 || next >= rows.length) return;
    [rows[at], rows[next]] = [rows[next], rows[at]];
    for (const [sortOrder, row] of rows.entries()) {
      if (kind === "category") await tx.category.update({ where: { id: row.id }, data: { sortOrder } });
      else await tx.menuItem.update({ where: { id: row.id }, data: { sortOrder } });
    }
  });
}
