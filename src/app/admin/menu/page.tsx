import { getLocale, getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { getAdminMenu } from "@/lib/menu/queries";
import type { Locale } from "@/lib/i18n/l10n";
import { MenuManager } from "./MenuManager";

export default async function MenuAdminPage() {
  const user = await requirePageUser();
  const [menu, locale, t] = await Promise.all([getAdminMenu(), getLocale(), getTranslations("menuAdmin")]);
  return <main className="mx-auto w-full max-w-content px-6 py-8">
    <h1 className="font-heading text-3xl">{t("title")}</h1>
    <MenuManager menu={menu} locale={locale as Locale} owner={user.role === "OWNER"} />
  </main>;
}
