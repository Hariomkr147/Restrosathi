import { expect, it } from "vitest";
import { getSettings } from "./index";
import { hoursSchema } from "./schema";

it("returns the seeded restaurant", async () => {
  const s = await getSettings();
  expect(s.name).toBe("Saffron Tadka");
  expect(s.about.en.length).toBeGreaterThan(0);
  expect(s.hours.mon[0]).toEqual({ open: "11:00", close: "23:00" });
});

it("rejects malformed hours", () => {
  expect(hoursSchema.safeParse({ mon: [{ open: "25:00", close: "23:00" }] }).success).toBe(false);
});

it("accepts overnight hours", () => {
  const all = Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, [{ open: "18:00", close: "01:00" }]]),
  );
  expect(hoursSchema.safeParse(all).success).toBe(true);
});

import { settingsInputSchema } from "./schema";
import { updateSettings } from "./index";

it("REGULAR tax mode without GSTIN is rejected", () => {
  const result = settingsInputSchema.safeParse({
    name: "A", address: "B", phone: "+919999900000", whatsappPhone: "+919999900000", about: { en: "A" }, hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    taxMode: "REGULAR", gstRatePercent: 5, pricesIncludeTax: true, staffCanDiscount: false, gstin: "", fssai: ""
  });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues[0].path).toContain("gstin");
});

it("invalid GSTIN format is rejected", () => {
  const result = settingsInputSchema.safeParse({
    name: "A", address: "B", phone: "+919999900000", whatsappPhone: "+919999900000", about: { en: "A" }, hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    taxMode: "REGULAR", gstRatePercent: 5, pricesIncludeTax: true, staffCanDiscount: false, gstin: "INVALID123", fssai: ""
  });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues[0].path).toContain("gstin");
});

it("valid test value 27AAAAA0000A1Z5 is accepted", () => {
  const result = settingsInputSchema.safeParse({
    name: "A", address: "B", phone: "+919999900000", whatsappPhone: "+919999900000", about: { en: "A" }, hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    taxMode: "REGULAR", gstRatePercent: 5, pricesIncludeTax: true, staffCanDiscount: false, gstin: "27AAAAA0000A1Z5", fssai: ""
  });
  expect(result.success).toBe(true);
});

it("gstRatePercent 29 is rejected", () => {
  const result = settingsInputSchema.safeParse({
    name: "A", address: "B", phone: "+919999900000", whatsappPhone: "+919999900000", about: { en: "A" }, hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    taxMode: "NONE", gstRatePercent: 29, pricesIncludeTax: true, staffCanDiscount: false, gstin: "", fssai: ""
  });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues[0].path).toContain("gstRatePercent");
});
