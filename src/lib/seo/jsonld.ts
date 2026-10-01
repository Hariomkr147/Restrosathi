import type { SettingsView } from "../settings";

const days = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" } as const;

export function restaurantJsonLd(settings: SettingsView, siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org", "@type": "Restaurant", name: settings.name,
    description: settings.about.en, address: settings.address, telephone: settings.phone,
    url: new URL("/", siteUrl).href, menu: new URL("/menu", siteUrl).href,
    openingHoursSpecification: Object.entries(days).flatMap(([key, day]) =>
      settings.hours[key as keyof typeof days].map((shift) => ({
        "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${day}`, opens: shift.open, closes: shift.close,
      }))),
  };
}

export function whatsappChatUrl(phoneE164: string, text?: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}${text === undefined ? "" : `?text=${encodeURIComponent(text)}`}`;
}
