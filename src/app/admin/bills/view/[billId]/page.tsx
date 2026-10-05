import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatINR } from "@/lib/money/format";
import Link from "next/link";
import { CancelBillButton } from "./CancelBillButton";
import { getTranslations } from "next-intl/server";

export default async function ViewBillPage({ params }: { params: Promise<{ billId: string }> }) {
  const user = await requireUser();
  const { billId } = await params;
  const t = await getTranslations("Admin.Bills.View");

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      payments: true,
      lines: true,
      session: {
        include: { table: true }
      }
    }
  });

  if (!bill) notFound();

  // Parse header
  const typeLabel = bill.session.kind === "TAKEAWAY" ? t("takeaway") : bill.session.table?.label || "-";

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")} {bill.number || ""}</h1>
          <p className="text-sm text-gray-500">{t("generatedAt")} {bill.generatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
        </div>
        <div className="flex items-center gap-4">
          <a href={`/admin/bills/view/${billId}/print`} target="_blank" className="text-sm font-medium text-blue-600 hover:underline">
            {t("print")}
          </a>
          <Link href="/admin/bills/history" className="text-sm font-medium text-blue-600 hover:underline">
            {t("backToHistory")}
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg border">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">{t("statusInfo")}</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">{t("status")}:</span> <span className="font-medium">{t(bill.status === "SETTLED" ? "statusSettled" : "statusCancelled")}</span></p>
            <p><span className="text-gray-500">{t("type")}:</span> {typeLabel}</p>
            {bill.customerName && <p><span className="text-gray-500">{t("customer")}:</span> {bill.customerName}</p>}
            {bill.customerPhone && <p><span className="text-gray-500">{t("phone")}:</span> {bill.customerPhone}</p>}
          </div>
        </div>

        {bill.status === "CANCELLED" && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-100 text-red-900">
            <h2 className="text-sm font-semibold mb-2">{t("cancelInfo")}</h2>
            <div className="space-y-1 text-sm">
              <p><span className="opacity-75">{t("cancelReason")}:</span> {bill.cancelReason}</p>
              {bill.cancelledAt && <p><span className="opacity-75">{t("cancelledAt")}:</span> {bill.cancelledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 font-medium text-gray-600">{t("item")}</th>
              <th className="px-4 py-2 font-medium text-gray-600 text-right">{t("qty")}</th>
              <th className="px-4 py-2 font-medium text-gray-600 text-right">{t("price")}</th>
              <th className="px-4 py-2 font-medium text-gray-600 text-right">{t("total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bill.lines.map(line => {
              const name = (line.name as { en?: string })?.en || "Item";
              return (
                <tr key={line.id}>
                  <td className="px-4 py-3">{name}</td>
                  <td className="px-4 py-3 text-right">{line.qty}</td>
                  <td className="px-4 py-3 text-right">{formatINR(line.unitPricePaise)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(line.linePaise)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">{t("subtotal")}</span><span>{formatINR(bill.subtotalPaise)}</span></div>
          {bill.discountPaise > 0 && (
            <div className="flex justify-between text-green-600"><span>{t("discount")}</span><span>-{formatINR(bill.discountPaise)}</span></div>
          )}
          {bill.cgstPaise > 0 && (
            <div className="flex justify-between text-gray-600"><span>{t("cgst")}</span><span>{formatINR(bill.cgstPaise)}</span></div>
          )}
          {bill.sgstPaise > 0 && (
            <div className="flex justify-between text-gray-600"><span>{t("sgst")}</span><span>{formatINR(bill.sgstPaise)}</span></div>
          )}
          {bill.roundOffPaise !== 0 && (
            <div className="flex justify-between text-gray-600"><span>{t("roundOff")}</span><span>{formatINR(bill.roundOffPaise)}</span></div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t"><span>{t("netTotal")}</span><span>{formatINR(bill.totalPaise)}</span></div>
        </div>
      </div>

      {bill.payments.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">{t("payments")}</h2>
          <div className="flex gap-4">
            {bill.payments.map(p => (
              <div key={p.id} className="bg-gray-50 border rounded p-3 text-sm">
                <p className="font-medium">{p.method}</p>
                <p className="text-gray-600">{formatINR(p.amountPaise)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {user.role === "OWNER" && bill.status === "SETTLED" && (
        <div className="border-t pt-6">
          <CancelBillButton billId={bill.id} />
        </div>
      )}

      {bill.status === "OPEN" && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex justify-end items-center md:pl-64">
          <Link href={`/admin/bills/view/${billId}/settle`} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold">
            Settle
          </Link>
        </div>
      )}
    </div>
  );
}
