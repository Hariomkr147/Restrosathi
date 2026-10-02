import { beforeEach, expect, it } from "vitest";
import { asAnonymous, asOwner, asStaff } from "../../../tests/helpers/auth";
import { AuthError } from "../auth/session";
import { prisma } from "../db";
import { getPublicMenu, type PublicItem } from "./queries";
import { deleteCategory, deleteItem, setItemAvailability, upsertCategory, upsertItem, reorderMenu, uploadMenuPhoto } from "./mutations";

const input = (item: PublicItem) => ({ ...item, basePricePaise: item.basePricePaise ?? undefined, description: item.description ?? undefined });
const item = async (id: string) => (await getPublicMenu()).categories.flatMap((entry) => entry.items).find((entry) => entry.id === id)!;
beforeEach(async () => { asAnonymous(); await prisma.auditLog.deleteMany({ where: { action: { startsWith: "menu." } } }); });

it("staff cannot edit items", async () => {
  await asStaff(); await expect(upsertItem(input(await item("butter-naan")))).rejects.toBeInstanceOf(AuthError);
});
it("anonymous and staff cannot invoke owner mutations", async () => {
  for (const role of [asAnonymous, asStaff]) {
    await role();
    await expect(upsertCategory({ name: { en: "Test" } })).rejects.toBeInstanceOf(AuthError);
    await expect(deleteCategory("starters")).rejects.toBeInstanceOf(AuthError);
    await expect(deleteItem("butter-naan")).rejects.toBeInstanceOf(AuthError);
    await expect(reorderMenu("category", "starters", "down")).rejects.toBeInstanceOf(AuthError);
    await expect(uploadMenuPhoto(new FormData())).rejects.toBeInstanceOf(AuthError);
  }
  asAnonymous(); await expect(setItemAvailability("dal-makhani", false)).rejects.toBeInstanceOf(AuthError);
});
it("staff can mark sold out and audits availability", async () => {
  await asStaff();
  try {
    await setItemAvailability("dal-makhani", false);
    expect((await prisma.menuItem.findUniqueOrThrow({ where: { id: "dal-makhani" } })).available).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "menu.availability" } })).toBe(1);
  } finally { await setItemAvailability("dal-makhani", true); }
});
it("audits price changes with before and after", async () => {
  await asOwner(); const before = input(await item("butter-naan"));
  try {
    await upsertItem({ ...before, basePricePaise: 7000 });
    const row = await prisma.auditLog.findFirst({ where: { action: "menu.price_change" }, orderBy: { at: "desc" } });
    expect(row?.data).toMatchObject({ before: { basePricePaise: 6000 }, after: { basePricePaise: 7000 } });
  } finally { await upsertItem(before); }
});
it("blocks deleting a non-empty category", async () => {
  await asOwner(); await expect(deleteCategory("starters")).rejects.toMatchObject({ code: "CATEGORY_NOT_EMPTY" });
});
it("creates and deletes a category and item with nested choices", async () => {
  await asOwner();
  const category = await upsertCategory({ name: { en: "Editor test", hi: "परीक्षण" } });
  const saved = await upsertItem({ ...input(await item("butter-naan")), id: undefined, categoryId: category.id });
  expect((await item(saved.id)).modifierGroups[0].options).toHaveLength(2);
  await deleteItem(saved.id); await deleteCategory(category.id);
});
it("replaces variants and options atomically and rejects unsafe input", async () => {
  await asOwner(); const before = input(await item("dal-makhani"));
  try {
    await upsertItem({ ...before, variants: [{ name: { en: "Test portion" }, pricePaise: 21000 }] });
    expect((await item("dal-makhani")).variants).toHaveLength(1);
    await expect(upsertItem({ ...before, basePricePaise: 1 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(upsertItem({ ...before, photoUrl: "/uploads/../secret.webp" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await item("dal-makhani")).variants[0].pricePaise).toBe(21000);
  } finally { await upsertItem(before); }
});
it("moves rows using up/down controls", async () => {
  await asOwner();
  const before = await prisma.menuItem.findMany({ where: { categoryId: "starters" }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  try {
    await reorderMenu("item", before[0].id, "down");
    const after = (await getPublicMenu()).categories.find((entry) => entry.id === "starters")!;
    expect(after.items[0].id).toBe(before[1].id);
  } finally { for (const entry of before) await prisma.menuItem.update({ where: { id: entry.id }, data: { sortOrder: entry.sortOrder } }); }
});

it("concurrent edits keep one complete set of variants", async () => {
  await asOwner(); const before = input(await item("dal-makhani"));
  try {
    for (let loop = 0; loop < 3; loop++) {
      await Promise.all([18000, 19000].map((pricePaise) => upsertItem({ ...before, variants: [{ name: { en: "Test portion" }, pricePaise }] })));
      expect((await item("dal-makhani")).variants).toHaveLength(1);
    }
  } finally { await upsertItem(before); }
});
