import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/l10n";
import { LanguageToggleClient } from "./LanguageToggleClient";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export async function LanguageToggle() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("common")]);
  return <LanguageToggleClient locale={locale as Locale} className={cn(buttonVariants({ variant: "outline" }), "h-auto max-w-full break-words py-2 text-base")} text={{
    english: t("english"), hindi: t("hindi"), changingLanguage: t("changingLanguage"), languageError: t("languageError"),
  }} />;
}
