import { getSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { BookingForm } from "./BookingForm";

export const metadata = {
  title: "Book a Table | Saffron Tadka",
  description: "Request a table booking at Saffron Tadka.",
};

export default async function BookPage() {
  if (!FEATURES.bookings) notFound();

  const settings = await getSettings();
  const { getTranslations } = await import("next-intl/server");
  const tConsent = await getTranslations("consent.marketing");
  const marketingText = tConsent("text", { restaurant: settings.name });

  return (
    <main className="container max-w-lg mx-auto p-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-[var(--color-primary)] text-center">Book a Table</h1>
      <BookingForm maxPartySize={settings.maxPartySize} marketingText={marketingText} />
    </main>
  );
}
