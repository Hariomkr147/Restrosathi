import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicMenu } from "@/lib/menu/queries";
import { getSessionView } from "@/lib/orders/session-view";
import { getSettings } from "@/lib/settings";
import { OrderScreen } from "@/components/table/OrderScreen";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { Locale } from "@/lib/i18n/l10n";

export const dynamic = "force-dynamic";
export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const view = await getSessionView(code);
  if (!view) notFound();
  const [menu, locale, text, home, nav, settings] = await Promise.all([getPublicMenu(), getLocale(), getTranslations("table"), getTranslations("home"), getTranslations("nav"), getSettings()]);
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:inline-flex focus:min-h-touch focus:items-center focus:bg-secondary focus:px-4 focus:py-2">{nav("skip")}</a>
    <header className="border-b border-border"><div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-6 py-4">
      <p className="min-w-0 break-words font-heading text-2xl text-primary">{settings.name}</p><LanguageToggle />
    </div></header>
    <main id="main" className="mx-auto w-full max-w-content px-6 py-8 pb-28">
      <h1 id="table-heading" tabIndex={-1} className="break-words font-heading text-3xl">{text("tableLabel", { label: view.table.label })}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{home("demo")}</p>
      <OrderScreen menu={menu} locale={locale as Locale} code={code} initialView={view} />
    </main>
  </>;
}
