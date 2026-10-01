import { getTranslations } from "next-intl/server";

export default async function MenuLoading() {
  const t = await getTranslations("menu");
  return <main id="main" className="mx-auto w-full max-w-content px-6 py-8"><p role="status">{t("loading")}</p></main>;
}
