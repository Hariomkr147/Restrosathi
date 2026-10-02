import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getSettings } from "@/lib/settings";
import { FEATURES } from "@/lib/features";
import { HoursList } from "@/components/home/HoursAndMap";
import { FloatingContact } from "@/components/FloatingContact";
import { MenuTextProvider } from "@/components/menu/MenuText";
import { getMenuText } from "@/lib/menu/text";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [settings, t, home] = await Promise.all([getSettings(), getTranslations("nav"), getTranslations("home")]);
  return <MenuTextProvider value={await getMenuText()}>
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:inline-flex focus:min-h-touch focus:items-center focus:bg-secondary focus:px-4 focus:py-2">{t("skip")}</a>
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="inline-flex min-h-touch min-w-0 items-center break-words font-heading text-2xl text-primary hover:underline active:underline">{settings.name}</Link>
        <nav aria-label={t("main")} className="flex flex-wrap items-center gap-4">
          <Link href="/" className="inline-flex min-h-touch min-w-touch items-center text-base underline-offset-4 hover:underline active:underline">{t("home")}</Link>
          <Link href="/menu" className="inline-flex min-h-touch min-w-touch items-center text-base underline-offset-4 hover:underline active:underline">{t("menu")}</Link>
          {FEATURES.bookings && <Link href="/book" className="inline-flex min-h-touch min-w-touch items-center hover:underline">{t("book")}</Link>}
          {FEATURES.events && <Link href="/events" className="inline-flex min-h-touch min-w-touch items-center hover:underline">{t("events")}</Link>}
          <LanguageToggle />
        </nav>
      </div>
    </header>
    {children}
    <footer className="border-t border-border bg-secondary pb-24">
      <div className="mx-auto grid w-full max-w-content gap-8 px-6 py-8 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <p className="break-words font-heading text-2xl">{settings.name}</p>
          <p className="text-muted-foreground">{home("demo")}</p>
          <address className="break-words not-italic">{settings.address}</address>
        </div>
        <div className="min-w-0"><h2 className="font-heading text-2xl">{home("hours")}</h2><HoursList hours={settings.hours} /></div>
      </div>
    </footer>
    <FloatingContact phone={settings.phone} whatsappPhone={settings.whatsappPhone} />
  </MenuTextProvider>;
}
