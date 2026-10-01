import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await requirePageUser();
  const t = await getTranslations("admin");
  return <main className="mx-auto w-full max-w-content px-6 py-8">
    <h1 className="font-heading text-3xl">{t("title")}</h1>
    <p className="mt-4">{t("welcome", { name: user.name })}</p>
  </main>;
}
