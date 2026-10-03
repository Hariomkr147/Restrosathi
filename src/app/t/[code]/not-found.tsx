import { getTranslations } from "next-intl/server";

export default async function InvalidTable() {
  const text = await getTranslations("table");
  return <main id="main" className="mx-auto max-w-content space-y-4 px-6 py-8"><h1 className="font-heading text-3xl">{text("invalidLink")}</h1>
    <p>{text("invalidLinkHelp")}</p><a href="/menu" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{text("viewMenu")}</a>
  </main>;
}
