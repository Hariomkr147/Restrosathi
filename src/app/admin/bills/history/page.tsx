import { requireUser } from "@/lib/auth/session";
import { listBills } from "@/lib/billing/history";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatINR } from "@/lib/money/format";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<any> }) {
  const user = await requireUser();
  const t = await getTranslations("Admin.Bills.History");
  
  const params = await searchParams;
  const date = params.date || undefined;
  const query = params.query || undefined;
  
  const res = await listBills({ date, query }, user);
  if (!res.ok) {
    return <div className="p-4 text-red-500">{res.error}</div>;
  }

  const bills = res.bills;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link 
          href="/admin/bills"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {t("backToOpen")}
        </Link>
      </div>

      <form className="flex gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("searchLabel")}</label>
          <input
            type="text"
            name="query"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("dateLabel")}</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {t("searchBtn")}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
            <tr>
              <th className="px-4 py-3">{t("tableInvoice")}</th>
              <th className="px-4 py-3">{t("tableTime")}</th>
              <th className="px-4 py-3">{t("tableType")}</th>
              <th className="px-4 py-3 text-right">{t("tableTotal")}</th>
              <th className="px-4 py-3">{t("tableStatus")}</th>
              <th className="px-4 py-3 text-right">{t("tableAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bills.map(b => (
              <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{b.number}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {b.generatedAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {b.session.kind === "TAKEAWAY" ? t("takeaway") : b.session.table?.label || "-"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                  {formatINR(b.totalPaise)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    b.status === "SETTLED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {t(b.status === "SETTLED" ? "statusSettled" : "statusCancelled")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link 
                    href={`/admin/bills/view/${b.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {t("viewBtn")}
                  </Link>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  {t("noBills")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
