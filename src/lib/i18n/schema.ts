import { z } from "zod";

export const l10nSchema = z.object({
  en: z.string().trim().min(1, "English text is required."),
  hi: z.string().optional(),
});
