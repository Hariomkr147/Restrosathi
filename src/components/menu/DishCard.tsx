import Image from "next/image";
import { useTranslations } from "next-intl";
import { localize, type Locale } from "@/lib/i18n/l10n";
import { formatINR } from "@/lib/money/format";
import type { PublicItem } from "@/lib/menu/queries";

export function DishCard({ item, locale }: { item: PublicItem; locale: Locale }) {
  const t = useTranslations("menu");
  const name = localize(item.name, locale);
  return <article data-testid={"dish-" + item.name.en} className="min-w-0 border-b border-border py-6">
    {item.photoUrl && <Image src={item.photoUrl} alt={name} width={640} height={480} sizes="(max-width: 767px) 100vw, 50vw" className="mb-4 h-48 w-full rounded-lg object-cover" />}
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-6 shrink-0 ${item.isVeg ? "diet-veg" : "diet-nonveg"}`} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        {item.isVeg ? <circle cx="12" cy="12" r="5" fill="currentColor" /> : <path d="M12 6 18 17H6Z" fill="currentColor" />}
      </svg>
      <span>{t(item.isVeg ? "vegetarian" : "nonVegetarian")}</span>
      <span className="ml-auto">{t("spice", { level: item.spiceLevel })}</span>
    </div>
    <h3 className="mt-3 break-words font-heading text-xl">{name}</h3>
    {item.description && <p className="mt-2 break-words text-base text-muted-foreground">{localize(item.description, locale)}</p>}
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-base font-medium tabular-nums">
      {item.variants.length ? item.variants.map((variant) => <p key={variant.id}>{localize(variant.name, locale)} <span>{formatINR(variant.pricePaise)}</span></p>) : <p>{formatINR(item.basePricePaise!)}</p>}
    </div>
    {(item.tags.length > 0 || !item.available) && <div className="mt-3 flex flex-wrap gap-2 text-sm">
      {item.tags.map((tag) => <span key={tag} className="rounded-sm bg-secondary px-2 py-1 text-primary">{t(tag)}</span>)}
      {!item.available && <span className="rounded-sm border border-destructive px-2 py-1 font-medium text-destructive">{t("soldOut")}</span>}
    </div>}
  </article>;
}
