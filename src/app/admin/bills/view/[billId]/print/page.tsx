import { requireUser } from "@/lib/auth/session";
import { getBillPrint } from "@/lib/billing/print";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatINR } from "@/lib/money/format";
import "./print.css";

export default async function PrintBillPage({ params }: { params: Promise<{ billId: string }> }) {
  const user = await requireUser(); // Auth
  const { billId } = await params;
  
  const print = await getBillPrint(billId, user);
  if (!print) notFound();

  return (
    <div className="bill-print-container font-mono text-sm leading-tight text-black max-w-[80mm] mx-auto bg-white min-h-screen p-3">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold font-sans tracking-tight">{print.header.name}</h1>
        {print.header.address && <div className="text-xs mt-1 whitespace-pre-wrap">{print.header.address}</div>}
        {print.header.phone && <div className="text-xs mt-1">Ph: {print.header.phone}</div>}
        {print.header.gstin && <div className="text-xs mt-1">GSTIN: {print.header.gstin}</div>}
        {print.header.fssai && <div className="text-xs mt-1">FSSAI: {print.header.fssai}</div>}
      </div>

      <div className="text-center font-bold border-y border-dashed border-black py-1 mb-3 uppercase tracking-widest">
        {print.title}
      </div>

      <div className="mb-3 text-xs flex justify-between flex-wrap gap-1">
        <div>{print.where}</div>
        <div className="text-right">{print.dateTime}</div>
        {print.number && <div className="w-full mt-1">Invoice: <strong>{print.number}</strong></div>}
      </div>

      <table className="w-full mb-3 text-xs">
        <thead className="border-b border-dashed border-black">
          <tr>
            <th className="text-left font-normal py-1">Item</th>
            <th className="text-right font-normal py-1 w-8">Qty</th>
            <th className="text-right font-normal py-1 w-16">Amount</th>
          </tr>
        </thead>
        <tbody className="align-top">
          {print.lines.map((line, i) => {
            const name = (line.name as { en?: string })?.en || "Item";
            return (
              <tr key={i} className="border-b border-dashed border-gray-300 last:border-0">
                <td className="py-1 pr-2">{name}</td>
                <td className="text-right py-1">{line.qty}</td>
                <td className="text-right py-1">{formatINR(line.linePaise)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black pt-2 mb-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatINR(print.subtotal)}</span>
        </div>
        
        {print.discount && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatINR(print.discount.value)}</span>
          </div>
        )}

        {print.taxableValue !== undefined && (
          <div className="flex justify-between">
            <span>Taxable Value</span>
            <span>{formatINR(print.taxableValue)}</span>
          </div>
        )}

        {print.taxLines.map((tax, i) => (
          <div key={i} className="flex justify-between">
            <span>{tax.label}</span>
            <span>{formatINR(tax.paise)}</span>
          </div>
        ))}

        {print.roundOff !== 0 && (
          <div className="flex justify-between">
            <span>Round Off</span>
            <span>{formatINR(print.roundOff)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-dashed border-black">
          <span>Total</span>
          <span>{formatINR(print.total)}</span>
        </div>
      </div>

      {print.payments.length > 0 && (
        <div className="mb-4 text-xs">
          <div className="font-bold border-b border-dashed border-gray-400 mb-1 pb-1">Payments</div>
          {print.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.method}</span>
              <span>{formatINR(p.amountPaise)}</span>
            </div>
          ))}
        </div>
      )}

      {print.status === "OPEN" && (
        <div className="text-center font-bold border border-black p-1 mb-4">
          Draft – not paid
        </div>
      )}

      {print.status === "CANCELLED" && (
        <div className="text-center mb-4">
          <div className="font-bold text-xl uppercase tracking-widest border border-black inline-block px-4 py-1">CANCELLED</div>
          <div className="text-xs mt-1">On {print.cancelledAt}</div>
        </div>
      )}

      <div className="text-center text-xs mt-6 mb-2">
        Thank you! Visit again.
      </div>
    </div>
  );
}
