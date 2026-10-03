"use client";

import { useEffect, useState } from "react";
import { useMenuText } from "./MenuText";
import { localize, type Locale } from "@/lib/i18n/l10n";
import { filterMenu } from "@/lib/menu/filter";
import type { PublicMenu, PublicItem } from "@/lib/menu/queries";
import { DishCard } from "./DishCard";

export function MenuView({ menu, locale, onAdd, addText, buttonClass }: { menu: PublicMenu; locale: Locale; onAdd?: (item: PublicItem) => void; addText?: string; buttonClass?: string }) {
  const text = useMenuText();
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [activeId, setActiveId] = useState(menu.categories[0]?.id);
  const filtered = filterMenu(menu, { query, vegOnly });
  const categoryIds = filtered.categories.map((category) => category.id).join(",");
  const active = filtered.categories.some((category) => category.id === activeId) ? activeId : filtered.categories[0]?.id;

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible) setActiveId(visible.target.id.replace("category-", ""));
    }, { rootMargin: "-20% 0px -65% 0px" });
    for (const id of categoryIds.split(",").filter(Boolean)) {
      const element = document.getElementById(`category-${id}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [categoryIds]);

  if (!menu.categories.length) return <p role="status" className="py-8">{text.empty}</p>;
  return <>
    <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-2">
        <label htmlFor="dish-search" className="block font-medium">{text.search}</label>
        <input id="dish-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          className="min-h-touch w-full rounded-md border border-muted-foreground bg-secondary px-3 py-2 text-base" />
      </div>
      <button type="button" role="switch" aria-checked={vegOnly} onClick={() => setVegOnly((value) => !value)}
        className={`inline-flex min-h-touch items-center justify-center gap-3 rounded-md border px-4 py-2 text-base transition-colors ${vegOnly ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80" : "border-muted-foreground bg-secondary hover:bg-muted active:bg-muted"}`}>
        <span aria-hidden="true" className={`inline-flex size-6 items-center justify-center rounded-sm border ${vegOnly ? "border-primary-foreground" : "border-muted-foreground"}`}>
          {vegOnly && <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>}
        </span>{text.vegOnly}
      </button>
    </div>
    <nav aria-label={text.categories} className="sticky top-0 z-10 mt-6 border-b border-border bg-background py-2">
      <div className="flex max-w-full gap-2 overflow-x-auto p-2">
        {filtered.categories.map((category) => <a key={category.id} href={`#category-${category.id}`}
          aria-current={active === category.id ? "location" : undefined} onClick={() => setActiveId(category.id)}
          className={`inline-flex min-h-touch shrink-0 items-center rounded-md px-4 py-2 text-base transition-colors ${active === category.id ? "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80" : "hover:bg-secondary active:bg-secondary"}`}>
          {localize(category.name, locale)}
        </a>)}
      </div>
    </nav>
    {!filtered.categories.length && <p role="status" className="py-8">{text.noResults}</p>}
    {filtered.categories.map((category) => <section key={category.id} id={`category-${category.id}`} className="menu-category mt-10" aria-labelledby={`heading-${category.id}`}>
      <h2 id={`heading-${category.id}`} className="break-words font-heading text-2xl text-primary">{localize(category.name, locale)}</h2>
      <div className="grid gap-x-8 md:grid-cols-2">{category.items.map((item) => <DishCard key={item.id} item={item} locale={locale}>
        {onAdd && item.available && <button type="button" className={`${buttonClass} mt-4`} onClick={() => onAdd(item)}>{addText}</button>}
      </DishCard>)}</div>
    </section>)}
  </>;
}
