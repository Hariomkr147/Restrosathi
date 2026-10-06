import { getTranslations, getMessages } from "next-intl/server";
import { getActivePackages } from "@/lib/events/packages";
import { EnquiryForm } from "./EnquiryForm";
import { formatINR } from "@/lib/money/format";
import { NextIntlClientProvider } from "next-intl";

export default async function EventsPage() {
  const t = await getTranslations("events");
  const messages = await getMessages();
  const activePackages = await getActivePackages();

  return (
    <main className="max-w-[var(--width-content)] mx-auto p-[calc(var(--spacing)*4)] space-y-[calc(var(--spacing)*8)]">
      <header className="text-center space-y-[calc(var(--spacing)*4)]">
        <h1 className="text-4xl font-display text-[var(--color-primary)]">{t("title")}</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl mx-auto">{t("subtitle")}</p>
      </header>

      {activePackages.length > 0 && (
        <section className="space-y-[calc(var(--spacing)*4)]">
          <h2 className="text-2xl font-display">{t("packagesTitle")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[calc(var(--spacing)*4)]">
            {activePackages.map(pkg => (
              <div key={pkg.id} className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-[calc(var(--spacing)*4)] bg-[var(--color-surface-raised)] flex flex-col h-full">
                <h3 className="font-bold text-lg">{pkg.name.en}</h3>
                <p className="text-[var(--color-text-muted)] mt-[calc(var(--spacing)*2)] flex-grow whitespace-pre-wrap">{pkg.description.en}</p>
                
                <div className="mt-[calc(var(--spacing)*4)] pt-[calc(var(--spacing)*4)] border-t border-[var(--color-border)] text-sm flex justify-between">
                  <div>
                    <div className="text-[var(--color-text-muted)]">{t("pricePerPlate")}</div>
                    <div className="font-bold">{formatINR(pkg.pricePerPlatePaise)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--color-text-muted)]">{t("minGuests")}</div>
                    <div className="font-bold">{pkg.minGuests} {t("guests")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-2xl mx-auto border border-[var(--color-border)] rounded-[var(--radius-lg)] p-[calc(var(--spacing)*6)] bg-[var(--color-surface-raised)] shadow-sm">
        <h2 className="text-2xl font-display mb-[calc(var(--spacing)*2)]">{t("enquiryFormTitle")}</h2>
        <p className="text-[var(--color-text-muted)] mb-[calc(var(--spacing)*6)]">{t("enquiryFormSubtitle")}</p>
        <NextIntlClientProvider messages={{events: (messages as any).events}}>
          <EnquiryForm packages={activePackages.map(p => ({ id: p.id, name: p.name.en }))} />
        </NextIntlClientProvider>
      </section>
    </main>
  );
}
