import { z } from "zod";

export const eventPackageSchema = z.object({
  name: z.object({
    en: z.string().min(1).max(60),
    hi: z.string().optional()
  }),
  description: z.object({
    en: z.string().min(1).max(300),
    hi: z.string().optional()
  }),
  pricePerPlatePaise: z.number().int().min(1),
  minGuests: z.number().int().min(1).max(500),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const eventEnquiryInputSchema = z.object({
  packageId: z.string().uuid().optional(),
  eventType: z.enum(["BIRTHDAY", "CORPORATE", "OTHER"]),
  name: z.string().min(1).max(60),
  phone: z.string(), // normalized and validated in action
  guests: z.number().int().min(1).max(500),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  message: z.string().max(600).optional(),
  honeypot: z.string().optional(),
});
