import { expect, it } from "vitest";
import { filterMenu } from "./filter";
import type { PublicItem, PublicMenu } from "./queries";

const item = (id: string, en: string, hi: string | undefined, isVeg: boolean): PublicItem => ({
  id, categoryId: "test", name: { en, hi }, description: null, basePricePaise: 6000, variants: [], modifierGroups: [],
  isVeg, spiceLevel: 0, tags: [], available: true, photoUrl: null, sortOrder: 0,
});
const menu: PublicMenu = { categories: [
  { id: "main", name: { en: "Main Course" }, items: [item("dal", "Dal Makhani", "दाल मखनी", true), item("chicken", "Butter Chicken", "बटर चिकन", false)] },
  { id: "breads", name: { en: "Breads" }, items: [item("naan", "Butter Naan", undefined, true)] },
] };
const names = (menu: PublicMenu) => menu.categories.flatMap((category) => category.items.map((item) => item.name.en));

it("vegOnly removes non-veg dishes", () => expect(names(filterMenu(menu, { query: "", vegOnly: true }))).not.toContain("Butter Chicken"));
it("matches Hindi names", () => expect(names(filterMenu(menu, { query: "दाल", vegOnly: false }))).toEqual(["Dal Makhani"]));
it("matches English case-insensitively", () => expect(names(filterMenu(menu, { query: "  NAAN ", vegOnly: false }))).toEqual(["Butter Naan"]));
it("drops empty categories", () => expect(filterMenu(menu, { query: "naan", vegOnly: false }).categories).toHaveLength(1));
it("returns no matches without changing the source menu", () => {
  expect(filterMenu(menu, { query: "missing", vegOnly: false }).categories).toEqual([]);
  expect(names(menu)).toHaveLength(3);
});
