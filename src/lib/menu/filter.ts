import type { PublicMenu } from "./queries";

export function filterMenu(menu: PublicMenu, filter: { query: string; vegOnly: boolean }): PublicMenu {
  const query = filter.query.trim().toLocaleLowerCase();
  return { categories: menu.categories.map((category) => ({
    ...category, items: category.items.filter((item) => (!filter.vegOnly || item.isVeg) &&
      [item.name.en, item.name.hi ?? ""].some((name) => name.toLocaleLowerCase().includes(query))),
  })).filter((category) => category.items.length > 0) };
}
