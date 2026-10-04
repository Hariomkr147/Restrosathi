import { prisma } from "../db";
import type { L10n } from "../i18n/l10n";
import { hoursSchema, l10nSchema, settingsInputSchema, type Hours } from "./schema";
import { requireUser } from "../auth/session";
import { audit } from "../audit";

export type SettingsView = {
  name: string;
  about: L10n;
  address: string;
  phone: string;
  whatsappPhone: string;
  mapEmbedUrl: string | null;
  googleReviewUrl: string | null;
  hours: Hours;
  taxMode: "NONE" | "COMPOSITION" | "REGULAR";
  gstRatePercent: number;
  pricesIncludeTax: boolean;
  gstin: string | null;
  fssai: string | null;
  staffCanDiscount: boolean;
  taxModeConfirmedAt: Date | null;
};

export async function getSettings(): Promise<SettingsView> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error("Restaurant settings are missing. Run the database seed.");
  return { ...settings, about: l10nSchema.parse(settings.about), hours: hoursSchema.parse(settings.hours) };
}

export async function updateSettings(input: unknown): Promise<{ ok: true } | { ok: false; fieldErrors: Record<string, string[]> }> {
  const user = await requireUser("OWNER");
  const result = settingsInputSchema.safeParse(input);
  if (!result.success) return {
    ok: false,
    fieldErrors: Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), ["invalid"]])),
  };
  await prisma.$transaction(async (tx) => {
    const before = await tx.settings.findUniqueOrThrow({ where: { id: 1 } });
    const after = await tx.settings.update({ where: { id: 1 }, data: { ...result.data, taxModeConfirmedAt: new Date() } });
    await audit({ actorId: user.id, action: "settings.update", entity: "Settings", entityId: "1", data: JSON.parse(JSON.stringify({ before, after })) }, tx);
  });
  return { ok: true };
}
