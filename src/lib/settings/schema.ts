import { z } from "zod";
import { l10nSchema } from "../i18n/schema";
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
  taxMode: z.enum(["NONE", "COMPOSITION", "REGULAR"]).default("NONE"),
  gstRatePercent: z.coerce.number().int().min(0).max(28).default(5),
  pricesIncludeTax: z.coerce.boolean().default(true),
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN format").or(z.literal("")).nullable().optional(),
  fssai: z.string().trim().regex(/^\d{14}$/, "FSSAI must be 14 digits").or(z.literal("")).nullable().optional(),
  staffCanDiscount: z.coerce.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.taxMode === "REGULAR" && (!data.gstin || data.gstin.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "GSTIN is required for REGULAR tax mode",
      path: ["gstin"],
    });
  }
});
