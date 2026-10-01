import { getTranslations } from "next-intl/server";
import { DishCard } from "@/components/menu/DishCard";
import type { Locale } from "@/lib/i18n/l10n";
import type { PublicMenu } from "@/lib/menu/queries";

export async function SignatureDishes({ menu, locale }: { menu: PublicMenu; locale: Locale }) {
  const t = await getTranslations("home");
  const items = menu.categories.flatMap((category) => category.items).filter((item) => item.tags.includes("CHEFS_SPECIAL")).slice(0, 6);
  if (!items.length) return null;
  return <section aria-labelledby="signature-title" className="mx-auto w-full max-w-content px-6 py-10">
    <h2 id="signature-title" className="font-heading text-3xl">{t("signatureDishes")}</h2>
    <div className="grid gap-x-8 md:grid-cols-2">{items.map((item) => <DishCard key={item.id} item={item} locale={locale} />)}</div>
  </section>;
}
