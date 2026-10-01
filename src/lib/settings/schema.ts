import { z } from "zod";
export { l10nSchema } from "../i18n/l10n";

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
