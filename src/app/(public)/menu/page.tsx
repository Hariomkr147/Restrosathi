import { getLocale, getTranslations } from "next-intl/server";
import { MenuView } from "@/components/menu/MenuView";
import { getPublicMenu } from "@/lib/menu/queries";
import type { Locale } from "@/lib/i18n/l10n";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const [menu, locale, t, home] = await Promise.all([getPublicMenu(), getLocale(), getTranslations("menu"), getTranslations("home")]);
  return <main id="main" className="mx-auto w-full max-w-content px-6 py-8">
    <h1 className="font-heading text-4xl">{t("title")}</h1>
    <p className="mt-3 text-base text-muted-foreground">{home("demo")}</p>
    <MenuView menu={menu} locale={locale as Locale} />
  </main>;
}
