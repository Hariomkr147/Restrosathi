import { Prisma, type RestaurantTable } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { audit } from "../audit";
import { generateTableCode } from "./code";

export class TableError extends Error {
  constructor(public code: "INVALID_LABEL" | "INVALID_INPUT" | "LABEL_TAKEN" | "NOT_FOUND") { super(code); this.name = "TableError"; }
}
function labelValue(label: unknown): string {
  const value = z.string().trim().min(1).max(20).safeParse(label);
  if (!value.success) throw new TableError("INVALID_LABEL");
  return value.data;
}
export async function listTables() {
  await requireUser();
  return prisma.restaurantTable.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}
// Public: diners resolve only active table codes; arbitrary input never grants staff access.
export async function findActiveTableByCode(code: string) {
  if (typeof code !== "string" || code.length !== 10) return null;
  return prisma.restaurantTable.findFirst({ where: { code, active: true } });
}
export async function createTable(label: string) {
  const user = await requireUser("OWNER");
  const value = labelValue(label);
  return prisma.$transaction(async (tx) => {
    const maximum = await tx.restaurantTable.aggregate({ _max: { sortOrder: true } });
    const table = await tx.restaurantTable.create({ data: { label: value, code: generateTableCode(), sortOrder: (maximum._max.sortOrder ?? -1) + 1 } });
    await audit({ actorId: user.id, action: "table.create", entity: "RestaurantTable", entityId: table.id, data: { after: table } }, tx);
    return table;
  }).catch(labelConflict);
}
function labelConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
      Array.isArray(error.meta?.target) && error.meta.target.includes("label")) throw new TableError("LABEL_TAKEN");
  throw error;
}
async function changeTable(id: string, actorId: string, action: string,
  data: (before: RestaurantTable) => Partial<Pick<RestaurantTable, "label" | "active" | "code">>) {
  if (!z.string().min(1).max(100).safeParse(id).success) throw new TableError("INVALID_INPUT");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "RestaurantTable" WHERE id = ${id} FOR UPDATE`;
    const before = await tx.restaurantTable.findUnique({ where: { id } });
    if (!before) throw new TableError("NOT_FOUND");
    const after = await tx.restaurantTable.update({ where: { id }, data: data(before) });
    await audit({ actorId, action, entity: "RestaurantTable", entityId: id, data: { before, after } }, tx);
    return after;
  }).catch(labelConflict);
}
export async function renameTable(id: string, label: string) {
  const user = await requireUser("OWNER");
  const value = labelValue(label);
  return changeTable(id, user.id, "table.rename", () => ({ label: value }));
}
export async function setTableActive(id: string, active: boolean) {
  const user = await requireUser("OWNER");
  if (!z.boolean().safeParse(active).success) throw new TableError("INVALID_INPUT");
  return changeTable(id, user.id, "table.active", () => ({ active }));
}
export async function regenerateTableCode(id: string) {
  const user = await requireUser("OWNER");
  return changeTable(id, user.id, "table.regenerate", (before) => {
    let code = generateTableCode();
    while (code === before.code) code = generateTableCode();
    return { code };
  });
}
