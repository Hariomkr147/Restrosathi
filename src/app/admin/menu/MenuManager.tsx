"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { localize, type Locale } from "@/lib/i18n/l10n";
import type { PublicMenu } from "@/lib/menu/queries";
import { deleteCategory, deleteItem, reorderMenu, setItemAvailability, upsertCategory } from "./actions";

const fieldClass = "min-h-touch w-full min-w-0 rounded-sm border border-muted-foreground bg-secondary px-3 py-2 text-base";
export function MenuManager({ menu, locale, owner }: { menu: PublicMenu; locale: Locale; owner: boolean }) {
  const t = useTranslations("menuAdmin"); const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  function run(operation: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null); setSaved(false);
    startTransition(async () => {
      try { const result = await operation(); if (!result.ok) setError(result.error); else { setSaved(true); router.refresh(); } }
      catch { setError("FAILED"); }
    });
  }
  function categoryForm(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    run(() => upsertCategory({ id, name: { en: String(form.get("en") ?? ""), hi: String(form.get("hi") ?? "") } }));
  }
  function reorder(kind: "category" | "item", id: string, index: number, length: number) {
    return <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={pending || index === 0} onClick={() => run(() => reorderMenu(kind, id, "up"))}>{t("up")}</Button>
      <Button type="button" variant="outline" disabled={pending || index === length - 1} onClick={() => run(() => reorderMenu(kind, id, "down"))}>{t("down")}</Button>
    </div>;
  }
  return <div className="mt-6 space-y-8">
    {error && <p role="alert" className="text-destructive">{t(`errors.${error}`)}</p>}
    {saved && <p role="status">{t("saved")}</p>}
    {owner && <Button asChild><Link href="/admin/menu/new">{t("addItem")}</Link></Button>}
    {!menu.categories.length && <p>{t("empty")}</p>}
    {menu.categories.map((category, index) => <section key={category.id} aria-labelledby={`admin-category-${category.id}`} className="space-y-4 border-t border-border pt-6">
      <h2 id={`admin-category-${category.id}`} className="break-words font-heading text-2xl">{localize(category.name, locale)}</h2>
      {owner && <>
        <form onSubmit={(event) => categoryForm(event, category.id)} onChange={() => setSaved(false)} className="grid gap-3 md:grid-cols-2">
          <div className="min-w-0 space-y-2"><label htmlFor={`category-en-${category.id}`}>{t("nameEn")}</label><input id={`category-en-${category.id}`} name="en" lang="en" required defaultValue={category.name.en} className={fieldClass} disabled={pending} /></div>
          <div className="min-w-0 space-y-2"><label htmlFor={`category-hi-${category.id}`}>{t("nameHi")}</label><input id={`category-hi-${category.id}`} name="hi" lang="hi" defaultValue={category.name.hi ?? ""} className={fieldClass} disabled={pending} /></div>
          <Button disabled={pending} type="submit">{t("saveCategory")}</Button>
          <Button disabled={pending || category.items.length > 0} variant="outline" type="button" onClick={() => run(() => deleteCategory(category.id))}>{t("deleteCategory")}</Button>
        </form>{category.items.length > 0 && <p className="text-sm text-muted-foreground">{t("categoryNotEmptyHint")}</p>}{reorder("category", category.id, index, menu.categories.length)}
      </>}
      <ul className="divide-y divide-border">{category.items.map((item, at) => <li key={item.id} className="space-y-3 py-4" data-testid={`admin-dish-${item.name.en}`}>
        <p className="break-words font-medium">{localize(item.name, locale)}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant={item.available ? "outline" : "secondary"} role="switch" aria-checked={!item.available}
            aria-label={t("soldOutFor", { name: localize(item.name, locale) })} aria-busy={pending} disabled={pending}
            className="h-auto whitespace-normal py-3 text-base" onClick={() => run(() => setItemAvailability(item.id, !item.available))}>{t(item.available ? "available" : "soldOut")}</Button>
          {owner && <>
            <Button asChild variant="outline"><Link href={`/admin/menu/${item.id}`}>{t("edit")}</Link></Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => { if (window.confirm(t("confirmDeleteItem"))) run(() => deleteItem(item.id)); }}>{t("deleteItem")}</Button>
            {reorder("item", item.id, at, category.items.length)}
          </>}
        </div>
      </li>)}</ul>
    </section>)}
    {owner && <form onSubmit={(event) => categoryForm(event)} onChange={() => setSaved(false)} className="space-y-3 border-t border-border pt-6">
      <h2 className="font-heading text-2xl">{t("addCategory")}</h2>
      <label htmlFor="new-category-en" className="block">{t("nameEn")}</label><input id="new-category-en" name="en" lang="en" className={fieldClass} required disabled={pending} />
      <label htmlFor="new-category-hi" className="block">{t("nameHi")}</label><input id="new-category-hi" name="hi" lang="hi" className={fieldClass} disabled={pending} />
      <Button type="submit" disabled={pending}>{t("addCategory")}</Button>
    </form>}
  </div>;
}
