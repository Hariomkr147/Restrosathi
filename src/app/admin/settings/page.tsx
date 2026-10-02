import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requirePageUser("OWNER");
  const [settings, t] = await Promise.all([getSettings(), getTranslations("settings")]);
  return <main className="mx-auto w-full max-w-content px-6 py-8">
    <h1 className="font-heading text-3xl">{t("title")}</h1>
    <SettingsForm settings={settings} />
  </main>;
}
