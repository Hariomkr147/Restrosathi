import { z } from "zod";
import { l10nSchema } from "../i18n/l10n";
export { l10nSchema };

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a time in HH:MM format.");
const shifts = z.array(z.object({ open: time, close: time }));

export const hoursSchema = z.object({
  mon: shifts,
  tue: shifts,
  wed: shifts,
  thu: shifts,
  fri: shifts,
  sat: shifts,
  sun: shifts,
});

export type Hours = z.infer<typeof hoursSchema>;

const optionalHttps = z.preprocess((value) => value === "" || value === undefined ? null : value,
  z.string().url().refine((value) => URL.canParse(value) && new URL(value).protocol === "https:").nullable());

export const settingsInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  about: l10nSchema,
  address: z.string().trim().min(1),
  phone: z.string().regex(/^\+91\d{10}$/),
  whatsappPhone: z.string().regex(/^\+91\d{10}$/),
  mapEmbedUrl: optionalHttps,
  googleReviewUrl: optionalHttps,
  hours: hoursSchema,
});
