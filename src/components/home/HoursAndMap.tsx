import { getTranslations } from "next-intl/server";
import type { SettingsView } from "@/lib/settings";
import type { Hours } from "@/lib/settings/schema";

export async function HoursList({ hours }: { hours: Hours }) {
  const t = await getTranslations("common");
  return <dl className="mt-4 space-y-3 text-base">
    {Object.entries(hours).map(([day, shifts]) => <div key={day} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt>{t(`days.${day}`)}</dt>
      <dd className="flex flex-wrap gap-2 tabular-nums">{shifts.length ? shifts.map((shift, index) => <span key={index}>{shift.open} – {shift.close}</span>) : t("closed")}</dd>
    </div>)}
  </dl>;
}

export async function HoursAndMap({ settings }: { settings: SettingsView }) {
  const t = await getTranslations("home");
  return <section className="mx-auto grid w-full max-w-content gap-8 px-6 py-10 md:grid-cols-2" aria-label={t("visiting")}>
    <div className="min-w-0">
      <h2 className="font-heading text-3xl">{t("hours")}</h2>
      <HoursList hours={settings.hours} />
    </div>
    <div className="min-w-0 space-y-4">
      <h2 className="font-heading text-3xl">{t("findUs")}</h2>
      <address className="break-words text-base not-italic">{settings.address}</address>
      {settings.mapEmbedUrl && <iframe src={settings.mapEmbedUrl} title={t("mapTitle")} loading="lazy" className="h-64 w-full border-0" referrerPolicy="no-referrer" />}
      {settings.googleReviewUrl && <a href={settings.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-touch min-w-touch items-center py-2 text-primary underline underline-offset-4">{t("googleReviews")}</a>}
    </div>
  </section>;
}
