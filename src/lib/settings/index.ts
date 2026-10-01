import { prisma } from "../db";
import { hoursSchema, type Hours } from "./schema";

export type SettingsView = {
  name: string;
  about: unknown;
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
  return { ...settings, hours: hoursSchema.parse(settings.hours) };
}
