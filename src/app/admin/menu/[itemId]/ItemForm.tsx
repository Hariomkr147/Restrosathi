"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { localize, type L10n, type Locale } from "@/lib/i18n/l10n";
import type { PublicItem } from "@/lib/menu/queries";
import { formatINR } from "@/lib/money/format";
import { parseINR } from "@/lib/money/parse";
import { upsertItem } from "../actions";

const fieldClass = "min-h-touch w-full min-w-0 rounded-sm border border-muted-foreground bg-secondary px-3 py-2 text-base";
const editablePrice = (paise: number) => formatINR(paise).replace(/[₹,]/g, "");
type Variant = { name: L10n; price: string };
type Group = { name: L10n; min: string; max: string; options: Variant[] };

function LocalizedFields({ id, value, onChange, description = false }: { id: string; value: L10n; onChange: (value: L10n) => void; description?: boolean }) {
  const t = useTranslations("menuAdmin");
  return <div className="grid gap-3 md:grid-cols-2">{(["en", "hi"] as const).map((locale) => <div key={locale} className="min-w-0 space-y-2">
    <label htmlFor={`${id}-${locale}`} className="block">{t(locale === "en" ? "nameEn" : "nameHi")}</label>
    {description ? <textarea id={`${id}-${locale}`} lang={locale} rows={3} className={fieldClass} value={value[locale] ?? ""} onChange={(e) => onChange({ ...value, [locale]: e.target.value })} />
      : <input id={`${id}-${locale}`} lang={locale} className={fieldClass} required={locale === "en"} value={value[locale] ?? ""} onChange={(e) => onChange({ ...value, [locale]: e.target.value })} />}
  </div>)}</div>;
}
export function ItemForm({ item, categories }: { item?: PublicItem; categories: { id: string; name: L10n }[] }) {
  const t = useTranslations("menuAdmin"); const locale = useLocale() as Locale; const router = useRouter();
  const [name, setName] = useState<L10n>(item?.name ?? { en: "", hi: "" });
  const [description, setDescription] = useState<L10n>(item?.description ?? { en: "", hi: "" });
  const [variantMode, setVariantMode] = useState(!!item?.variants.length);
  const [price, setPrice] = useState(item?.basePricePaise ? editablePrice(item.basePricePaise) : "");
  const [variants, setVariants] = useState<Variant[]>(item?.variants.map((entry) => ({ name: entry.name, price: editablePrice(entry.pricePaise) })) ?? []);
  const [groups, setGroups] = useState<Group[]>(item?.modifierGroups.map((group) => ({ name: group.name, min: String(group.min), max: String(group.max), options: group.options.map((entry) => ({ name: entry.name, price: editablePrice(entry.priceDeltaPaise) })) })) ?? []);
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const busy = pending || uploading;
  function priceField(id: string, value: string, set: (value: string) => void, modifier = false) {
    return <div className="min-w-0 space-y-2"><label htmlFor={id} className="block">{t(modifier ? "extraPrice" : "price")}</label>
      <input id={id} className={fieldClass} type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required value={value} onChange={(e) => set(e.target.value)} />
    </div>;
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setError(null); setUploading(true);
    try {
      const form = new FormData(); form.set("photo", file);
      const response = await fetch("/api/menu-photo", { method: "POST", body: form });
      const result = await response.json();
      if (result.ok && typeof result.url === "string") setPhotoUrl(result.url); else setError(result.error ?? "UPLOAD_FAILED");
    } catch { setError("UPLOAD_FAILED"); }
    finally { setUploading(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); setError(null);
    startTransition(async () => {
      try {
        const result = await upsertItem({
          id: item?.id, name, description: description.en || description.hi ? description : undefined,
          categoryId: String(form.get("categoryId")), basePricePaise: variantMode ? undefined : parseINR(price) ?? NaN,
          variants: variantMode ? variants.map((entry) => ({ name: entry.name, pricePaise: parseINR(entry.price) ?? NaN })) : [],
          modifierGroups: groups.map((group) => ({ name: group.name, min: Number(group.min), max: Number(group.max), options: group.options.map((entry) => ({ name: entry.name, priceDeltaPaise: parseINR(entry.price) ?? NaN })) })),
          isVeg: form.get("isVeg") === "on", available: form.get("available") === "on", spiceLevel: Number(form.get("spiceLevel")), tags: form.getAll("tags"), photoUrl,
        });
        if (!result.ok) setError(result.error); else { router.push("/admin/menu"); router.refresh(); }
      } catch { setError("FAILED"); }
    });
  }
  if (!categories.length) return <p className="mt-6">{t("needsCategory")} <Link href="/admin/menu" className="inline-flex min-h-touch items-center text-primary underline">{t("back")}</Link></p>;
  return <form onSubmit={submit} className="mt-6 space-y-6">
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-destructive">{t(`errors.${error}`)}</p>}
    {uploading && <p role="status">{t("uploading")}</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-8">
      <div className="space-y-2"><label htmlFor="categoryId" className="block font-medium">{t("category")}</label><select id="categoryId" name="categoryId" required defaultValue={item?.categoryId ?? categories[0].id} className={fieldClass}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{localize(entry.name, locale)}</option>)}</select></div>
      <fieldset className="min-w-0 space-y-3"><legend className="mb-3 font-heading text-2xl">{t("dishName")}</legend><LocalizedFields id="dish-name" value={name} onChange={setName} /></fieldset>
      <fieldset className="min-w-0 space-y-3"><legend className="mb-3 font-heading text-2xl">{t("description")}</legend><LocalizedFields id="description" value={description} onChange={setDescription} description /></fieldset>
      <fieldset className="min-w-0 space-y-4"><legend className="mb-3 font-heading text-2xl">{t("pricing")}</legend>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" checked={variantMode} onChange={(e) => setVariantMode(e.target.checked)} />{t("useVariants")}</label>
        {variantMode ? <>
          {variants.map((entry, index) => <fieldset key={index} className="min-w-0 space-y-3 border-b border-border pb-4"><legend className="mb-3 font-medium">{t("variant", { number: index + 1 })}</legend>
            <LocalizedFields id={`variant-${index}`} value={entry.name} onChange={(name) => setVariants(variants.map((value, at) => at === index ? { ...value, name } : value))} />
            {priceField(`variant-price-${index}`, entry.price, (price) => setVariants(variants.map((value, at) => at === index ? { ...value, price } : value)))}
            <Button type="button" variant="outline" onClick={() => setVariants(variants.filter((_, at) => at !== index))}>{t("removeVariant")}</Button>
          </fieldset>)}
          <Button type="button" variant="outline" onClick={() => setVariants([...variants, { name: { en: "", hi: "" }, price: "" }])}>{t("addVariant")}</Button>
        </> : priceField("base-price", price, setPrice)}
      </fieldset>
      <fieldset className="min-w-0 space-y-6"><legend className="mb-3 font-heading text-2xl">{t("modifiers")}</legend>
        {groups.map((group, index) => {
          const edit = (value: Group) => setGroups(groups.map((entry, at) => at === index ? value : entry));
          return <fieldset key={index} className="min-w-0 space-y-4 border-b border-border pb-6"><legend className="mb-3 font-medium">{t("group", { number: index + 1 })}</legend>
            <LocalizedFields id={`group-${index}`} value={group.name} onChange={(name) => edit({ ...group, name })} />
            <div className="grid gap-3 sm:grid-cols-2">{(["min", "max"] as const).map((key) => <div key={key} className="min-w-0 space-y-2"><label htmlFor={`group-${index}-${key}`} className="block">{t(key)}</label><input id={`group-${index}-${key}`} type="number" min={0} step={1} required className={fieldClass} value={group[key]} onChange={(e) => edit({ ...group, [key]: e.target.value })} /></div>)}</div>
            {group.options.map((option, at) => <fieldset key={at} className="min-w-0 space-y-3"><legend className="mb-3 font-medium">{t("option", { number: at + 1 })}</legend>
              <LocalizedFields id={`option-${index}-${at}`} value={option.name} onChange={(name) => edit({ ...group, options: group.options.map((value, where) => where === at ? { ...value, name } : value) })} />
              {priceField(`option-price-${index}-${at}`, option.price, (price) => edit({ ...group, options: group.options.map((value, where) => where === at ? { ...value, price } : value) }), true)}
              <Button type="button" variant="outline" onClick={() => edit({ ...group, options: group.options.filter((_, where) => where !== at) })}>{t("removeOption")}</Button>
            </fieldset>)}
            <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => edit({ ...group, options: [...group.options, { name: { en: "", hi: "" }, price: "0.00" }] })}>{t("addOption")}</Button><Button type="button" variant="outline" onClick={() => setGroups(groups.filter((_, at) => at !== index))}>{t("removeGroup")}</Button></div>
          </fieldset>;
        })}
        <Button type="button" variant="outline" onClick={() => setGroups([...groups, { name: { en: "", hi: "" }, min: "0", max: "1", options: [] }])}>{t("addGroup")}</Button>
      </fieldset>
      <fieldset className="min-w-0 space-y-3"><legend className="mb-3 font-heading text-2xl">{t("details")}</legend>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" name="isVeg" defaultChecked={item?.isVeg ?? true} />{t("vegetarian")}</label>
        <label className="flex min-h-touch items-center gap-3"><input type="checkbox" name="available" defaultChecked={item?.available ?? true} />{t("available")}</label>
        <label htmlFor="spiceLevel" className="block">{t("spice")}</label><select id="spiceLevel" name="spiceLevel" defaultValue={item?.spiceLevel ?? 0} className={fieldClass}>{[0, 1, 2, 3].map((level) => <option key={level} value={level}>{t("spiceLevel", { level })}</option>)}</select>
        {(["BESTSELLER", "CHEFS_SPECIAL", "NEW"] as const).map((tag) => <label key={tag} className="flex min-h-touch items-center gap-3"><input name="tags" type="checkbox" value={tag} defaultChecked={item?.tags.includes(tag)} />{t(tag)}</label>)}
      </fieldset>
      <fieldset className="min-w-0 space-y-3"><legend className="mb-3 font-heading text-2xl">{t("photo")}</legend>
        <p className="text-sm text-muted-foreground">{t("photoHint")}</p>
        {photoUrl && <><Image src={photoUrl} alt={localize(name, locale)} width={480} height={320} className="h-48 w-full rounded-lg object-cover" /><Button type="button" variant="outline" onClick={() => setPhotoUrl(null)}>{t("removePhoto")}</Button></>}
        <label htmlFor="photo" className="block">{t("choosePhoto")}</label><input id="photo" type="file" accept="image/jpeg,image/png,image/webp" className={fieldClass} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      </fieldset>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "saving" : "saveItem")}</Button><Button asChild variant="outline"><Link href="/admin/menu">{t("back")}</Link></Button></div>
    </fieldset>
  </form>;
}
