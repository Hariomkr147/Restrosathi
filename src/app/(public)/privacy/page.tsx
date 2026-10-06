import { getSettings } from "@/lib/settings";
import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const settings = await getSettings();
  const t = await getTranslations("privacy");

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 font-heading text-4xl">{t("title")}</h1>
      
      <div className="prose prose-stone dark:prose-invert">
        <h2>{t("whatWeCollect")}</h2>
        <p>{t("whatWeCollectText")}</p>
        
        <h2>{t("whyWeCollect")}</h2>
        <p>{t("whyWeCollectText")}</p>

        <h2>{t("thirdParties")}</h2>
        <p>{t("thirdPartiesText")}</p>

        <h2>{t("retention")}</h2>
        <p>{t("retentionText")}</p>

        <h2>{t("deletion")}</h2>
        <p>
          {t("deletionText", {
            restaurant: settings.name,
            phone: settings.phone,
          })}
        </p>
      </div>
    </main>
  );
}
