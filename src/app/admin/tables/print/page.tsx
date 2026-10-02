import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { listTables } from "@/lib/tables";
import { qrSvg, tableUrl } from "@/lib/qr";
import { PrintButton } from "./PrintButton";

export default async function TablePrintPage() {
  await requirePageUser();
  const t = await getTranslations("tables");
  const [settings, tables] = await Promise.all([getSettings(), listTables()]);
  const cards = await Promise.all(tables.filter((table) => table.active).map(async (table) => {
    const url = tableUrl(table.code);
    return { ...table, url, svg: await qrSvg(url) };
  }));
  return <main className="qr-print-page mx-auto w-full max-w-content space-y-6 px-6 py-8">
    <div className="print-controls flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{t("print")}</h1><PrintButton />
    </div>
    {cards.length ? <div className="qr-sheet grid gap-6 sm:grid-cols-2">{cards.map((card) => <article key={card.id} className="qr-card min-w-0 space-y-3 rounded-md border border-border bg-secondary p-4 text-center">
      <p className="break-words text-xl font-semibold">{settings.name}</p>
      <h2 className="break-words text-lg font-semibold">{t("tableLabel", { label: card.label })}</h2>
      <p>{t("scanInstruction")}</p>
      <div className="qr-code mx-auto" role="img" aria-label={t("qrFor", { label: card.label })}
        dangerouslySetInnerHTML={{ __html: card.svg.replace("<svg ", '<svg aria-hidden="true" ') }} />
      <p dir="ltr" className="break-all text-sm">{card.url.replace(/^https?:\/\//, "")}</p>
    </article>)}</div> : <p role="status">{t("noActive")}</p>}
  </main>;
}
