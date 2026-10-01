import { getLocale } from "next-intl/server";
import { Hero } from "@/components/home/Hero";
import { SignatureDishes } from "@/components/home/SignatureDishes";
import { HoursAndMap } from "@/components/home/HoursAndMap";
import type { Locale } from "@/lib/i18n/l10n";
import { getPublicMenu } from "@/lib/menu/queries";
import { restaurantJsonLd } from "@/lib/seo/jsonld";
import { getSettings } from "@/lib/settings";

export default async function Home() {
  const [settings, menu, locale] = await Promise.all([getSettings(), getPublicMenu(), getLocale()]);
  const jsonLd = JSON.stringify(restaurantJsonLd(settings, process.env.SITE_URL ?? "http://localhost:3000")).replace(/</g, "\\u003c");
  return <main id="main" className="pb-20">
    <Hero settings={settings} locale={locale as Locale} />
    <SignatureDishes menu={menu} locale={locale as Locale} />
    <HoursAndMap settings={settings} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
  </main>;
}
