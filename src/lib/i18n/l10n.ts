export type Locale = "en" | "hi";
export type L10n = { en: string; hi?: string };

export function localize(value: L10n, locale: Locale): string {
  return locale === "hi" && value.hi?.trim() ? value.hi : value.en;
}
