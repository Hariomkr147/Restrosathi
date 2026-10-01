import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getSettings } from "@/lib/settings";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [settings, t] = await Promise.all([getSettings(), getTranslations("nav")]);
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:inline-flex focus:min-h-touch focus:items-center focus:bg-secondary focus:px-4 focus:py-2">{t("skip")}</a>
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="inline-flex min-h-touch min-w-0 items-center break-words font-heading text-2xl text-primary hover:underline active:underline">{settings.name}</Link>
        <nav aria-label={t("main")} className="flex flex-wrap items-center gap-4">
          <Link href="/" className="inline-flex min-h-touch min-w-touch items-center text-base underline-offset-4 hover:underline active:underline">{t("home")}</Link>
          <Link href="/menu" className="inline-flex min-h-touch min-w-touch items-center text-base underline-offset-4 hover:underline active:underline">{t("menu")}</Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
    {children}
  </>;
}
