import { expect, it } from "vitest";
import { prisma } from "../db";
import { getPublicMenu } from "./queries";

it("returns seeded categories in order with sold-out items flagged", async () => {
  const menu = await getPublicMenu();
  expect(menu.categories.map((category) => category.name.en)).toEqual(["Starters", "Main Course", "Breads", "Rice", "Desserts", "Beverages"]);
  const items = menu.categories.flatMap((category) => category.items);
  expect(items).toHaveLength(20);
  expect(items.find((item) => item.name.en === "Mutton Rogan Josh")?.available).toBe(false);
  expect(items.some((item) => item.name.hi === undefined)).toBe(true);
  expect(items.some((item) => (item.name.hi?.length ?? 0) >= 40)).toBe(true);
  expect(items.find((item) => item.name.en === "Dal Makhani")?.variants.map((variant) => variant.pricePaise)).toEqual([18000, 32000]);
  expect(items.find((item) => item.name.en === "Butter Naan")?.modifierGroups[0].options.map((option) => option.priceDeltaPaise)).toEqual([1000, 3000]);
  expect(items.find((item) => item.name.en === "Paneer Tikka")?.modifierGroups[0]).toMatchObject({ min: 1, max: 1 });
});

it("omits empty categories", async () => {
  const category = await prisma.category.create({ data: { name: { en: "Empty test" }, sortOrder: -1 } });
  try { expect((await getPublicMenu()).categories.map((entry) => entry.id)).not.toContain(category.id); }
  finally { await prisma.category.delete({ where: { id: category.id } }); }
});

it("validates localized text on read", async () => {
  const category = await prisma.category.findFirstOrThrow();
  await prisma.category.update({ where: { id: category.id }, data: { name: { hi: "गलत" } } });
  try { await expect(getPublicMenu()).rejects.toThrow(); }
  finally { await prisma.category.update({ where: { id: category.id }, data: { name: category.name! } }); }
});
