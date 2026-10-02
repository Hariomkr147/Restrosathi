import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { listTables } from "@/lib/tables";
import { tableUrl } from "@/lib/qr";
import { TablesManager } from "./TablesManager";

export default async function TablesPage() {
  await requirePageUser("OWNER");
  const t = await getTranslations("tables");
  const tables = await listTables();
  return <main className="mx-auto w-full max-w-content space-y-6 px-6 py-8">
    <h1 className="text-3xl font-semibold">{t("title")}</h1>
    <TablesManager tables={tables.map((table) => ({ ...table, url: tableUrl(table.code) }))} />
  </main>;
}
