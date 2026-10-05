import { requireUser } from "@/lib/auth/session";
import { getDayEnd } from "@/lib/billing/day-end";
import { formatINR } from "@/lib/money/format";
import { PrintButton } from "@/components/PrintButton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function DayEndReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  if (user.role !== "OWNER") {
    redirect("/admin/board");
  }

  const t = await getTranslations("Admin.Reports.DayEnd");

  const resolvedParams = await searchParams;
  let dateStr = resolvedParams.date;
  if (!dateStr) {
    // default to today IST
    const today = new Date();
    // get YYYY-MM-DD in IST
    const ist = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
    dateStr = ist.toISOString().split("T")[0];
  }

  const report = await getDayEnd(dateStr, user);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")} {dateStr}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <form className="flex gap-2" method="GET">
            <input type="date" name="date" defaultValue={dateStr} className="border rounded px-2 text-sm" />
            <button type="submit" className="border rounded px-3 py-1 bg-gray-100 text-sm hover:bg-gray-200">{t("view")}</button>
          </form>
          <PrintButton className="border rounded px-3 py-1 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100">{t("print")}</PrintButton>
        </div>
      </div>

      {!report.reconciles && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md text-sm font-medium">
          {t("reconciliationError")}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
          <h2 className="font-semibold border-b pb-2">{t("salesSummary")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">{t("billCount")}</span><span>{report.billCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">{t("subtotal")}</span><span>{formatINR(report.subtotalPaise)}</span></div>
            <div className="flex justify-between text-green-700"><span className="text-gray-600">{t("discount")}</span><span>-{formatINR(report.discountPaise)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">{t("tax")}</span><span>{formatINR(report.taxPaise)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">{t("roundOff")}</span><span>{formatINR(report.roundOffPaise)}</span></div>
            <div className="flex justify-between font-bold pt-2 border-t text-base"><span className="text-gray-800">{t("total")}</span><span>{formatINR(report.totalPaise)}</span></div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
          <h2 className="font-semibold border-b pb-2">{t("paymentMethods")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">{t("cash")}</span><span>{formatINR(report.byMethod.CASH)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">{t("upi")}</span><span>{formatINR(report.byMethod.UPI)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">{t("card")}</span><span>{formatINR(report.byMethod.CARD)}</span></div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4 md:col-span-2">
          <h2 className="font-semibold border-b pb-2">{t("exceptions")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">{t("cancelledBills", { count: report.cancelled.count })}</span><span>{formatINR(report.cancelled.totalPaise)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">{t("voidedLines", { count: report.voidedLines.count })}</span><span>{formatINR(report.voidedLines.valuePaise)}</span></div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .max-w-4xl, .max-w-4xl * { visibility: visible; }
          .max-w-4xl { position: absolute; left: 0; top: 0; margin: 0; padding: 0; width: 100%; }
        }
      `}} />
    </div>
  );
}
