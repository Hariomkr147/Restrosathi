import { expect, it } from "vitest";
import type { SettingsView } from "../settings";
import { restaurantJsonLd, whatsappChatUrl } from "./jsonld";

const allDays = (shifts: { open: string; close: string }[]) => Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, shifts]),
) as SettingsView["hours"];
const settings: SettingsView = {
  name: "Saffron Tadka", about: { en: "Fictional demo restaurant" }, address: "Demo address, India (fictional)",
  phone: "+919999900000", whatsappPhone: "+919999900000", mapEmbedUrl: null, googleReviewUrl: null,
  hours: allDays([{ open: "11:00", close: "23:00" }]),
  taxMode: "NONE", gstRatePercent: 5, pricesIncludeTax: true, gstin: null, fssai: null, staffCanDiscount: false, taxModeConfirmedAt: null,
};
const url = "https://saffrontadka.example";

it("builds Restaurant JSON-LD", () => {
  const result = restaurantJsonLd(settings, url);
  expect(result["@type"]).toBe("Restaurant");
  expect(result.name).toBe("Saffron Tadka");
  expect(result.menu).toBe("https://saffrontadka.example/menu");
});
it("emits overnight hours as given", () => {
  const result = restaurantJsonLd({ ...settings, hours: allDays([{ open: "18:00", close: "01:00" }]) }, url);
  expect(result.openingHoursSpecification).toContainEqual(expect.objectContaining({ dayOfWeek: "https://schema.org/Monday", opens: "18:00", closes: "01:00" }));
});
it("builds a wa.me link", () => expect(whatsappChatUrl("+919876543210", "Hi")).toBe("https://wa.me/919876543210?text=Hi"));
it("encodes chat text and supports a link without text", () => {
  expect(whatsappChatUrl("+919876543210", "नमस्ते & hello")).toBe("https://wa.me/919876543210?text=" + encodeURIComponent("नमस्ते & hello"));
  expect(whatsappChatUrl("+919876543210")).toBe("https://wa.me/919876543210");
});
it("omits closed days and preserves second shifts", () => {
  const result = restaurantJsonLd({ ...settings, hours: { ...settings.hours, mon: [], tue: [{ open: "10:00", close: "14:00" }, { open: "18:00", close: "01:00" }] } }, url + "/");
  const shifts = result.openingHoursSpecification as { dayOfWeek: string }[];
  expect(shifts.some((shift) => shift.dayOfWeek === "https://schema.org/Monday")).toBe(false);
  expect(shifts.filter((shift) => shift.dayOfWeek === "https://schema.org/Tuesday")).toHaveLength(2);
  expect(result.menu).toBe(url + "/menu");
});
