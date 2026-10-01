import { prisma } from "../db";
import type { L10n } from "../i18n/l10n";
import { hoursSchema, l10nSchema, type Hours } from "./schema";

export type SettingsView = {
  name: string;
  about: L10n;
  address: string;
  phone: string;
  whatsappPhone: string;
  mapEmbedUrl: string | null;
  googleReviewUrl: string | null;
  hours: Hours;
};

export async function getSettings(): Promise<SettingsView> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error("Restaurant settings are missing. Run the database seed.");
  return { ...settings, about: l10nSchema.parse(settings.about), hours: hoursSchema.parse(settings.hours) };
}
