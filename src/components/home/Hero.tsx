import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";
import { localize, type Locale } from "@/lib/i18n/l10n";
import type { SettingsView } from "@/lib/settings";
import { HeroEntrance } from "./HeroEntrance";

export async function Hero({ settings, locale }: { settings: SettingsView; locale: Locale }) {
  const t = await getTranslations("home");
  return <section className="relative isolate flex min-h-128 items-center py-12" aria-labelledby="restaurant-title">
    <Image src="/brand/hero.webp" alt={t("heroAlt")} fill preload sizes="100vw" className="-z-10 object-cover" />
    <div className="mx-auto w-full max-w-content px-6">
      <HeroEntrance>
        <div className="max-w-lg bg-background p-6 md:p-8">
          <h1 id="restaurant-title" className="break-words font-heading text-4xl">{settings.name}</h1>
          <p className="mt-4 break-words text-lg">{localize(settings.about, locale)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="h-auto whitespace-normal py-3 text-base"><Link href="/menu">{t("viewMenu")}</Link></Button>
            {FEATURES.bookings && <Button asChild variant="outline" className="h-auto whitespace-normal py-3 text-base"><Link href="/book">{t("bookTable")}</Link></Button>}
            {FEATURES.events && <Button asChild variant="outline" className="h-auto whitespace-normal py-3 text-base"><Link href="/events">{t("planEvent")}</Link></Button>}
          </div>
        </div>
      </HeroEntrance>
    </div>
    <p className="absolute bottom-4 right-4 max-w-full bg-background px-3 py-2 text-sm text-muted-foreground">{t("illustrativePhoto")}</p>
  </section>;
}
