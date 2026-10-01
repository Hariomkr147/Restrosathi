import { z } from "zod";

export type Locale = "en" | "hi";
export type L10n = { en: string; hi?: string };

export const l10nSchema = z.object({
  en: z.string().trim().min(1, "English text is required."),
  hi: z.string().optional(),
});

export function localize(value: L10n, locale: Locale): string {
  return locale === "hi" && value.hi?.trim() ? value.hi : value.en;
}
