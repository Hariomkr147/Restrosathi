import { notFound } from "next/navigation";
import { getKot } from "@/lib/orders/kot";
import { PrintButton } from "./PrintButton";
import { requireUser } from "@/lib/auth/session";

export default async function KotPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ lang?: string }> }) {
  await requireUser();
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = searchParams.lang === "hi" ? "hi" : "en";
  const kot = await getKot(params.id, lang);

  if (!kot) {
    notFound();
  }

  // Formatting date
  const date = new Date(kot.placedAt);
  const timeStr = date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "numeric", minute: "2-digit" });
  const dateStr = date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });

  return (
    <div className="bg-white text-black min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: 80mm auto; margin: 3mm; }
        body { background: white; color: black; }
        /* Hide layout nav in print media if it exists */
        @media print {
          nav, header { display: none !important; }
          .print-hidden { display: none !important; }
        }
      `}} />
      <div className="w-[302px] max-w-full mx-auto font-mono text-sm leading-tight p-2 pt-4">
        {/* Header */}
        <div className="text-center mb-4 pb-2 border-b-2 border-black border-dashed">
          <div className="font-bold text-xl uppercase mb-1">{kot.restaurantName}</div>
          <div className="text-base font-bold">KITCHEN ORDER TICKET</div>
        </div>

        {/* Meta */}
        <div className="mb-4 pb-2 border-b border-black">
          <div className="flex justify-between items-start font-bold text-lg mb-1">
            <span>Table: {kot.tableLabel}</span>
            <span>#{kot.orderNo}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>{dateStr} {timeStr}</span>
          </div>
          {kot.customerName && (
            <div className="mt-1">Customer: {kot.customerName}</div>
          )}
        </div>

        {/* Items */}
        <div className="mb-6">
          <div className="flex font-bold border-b border-black pb-1 mb-2 text-xs uppercase">
            <span className="w-8">Qty</span>
            <span className="flex-1">Item</span>
          </div>
          
          {kot.lines.map((line, idx) => (
            <div key={idx} className="mb-3">
              <div className="flex text-base font-bold">
                <span className="w-8">{line.qty}x</span>
                <span className="flex-1">{line.name}</span>
              </div>
              {line.variant && (
                <div className="flex mt-1 text-sm">
                  <span className="w-8"></span>
                  <span className="flex-1 italic">- {line.variant}</span>
                </div>
              )}
              {line.modifiers.length > 0 && (
                <div className="flex mt-1 text-sm">
                  <span className="w-8"></span>
                  <span className="flex-1 uppercase">{line.modifiers.join(", ")}</span>
                </div>
              )}
              {line.note && (
                <div className="flex mt-1 text-sm font-bold border border-black p-1 ml-8">
                  <span>Note: {line.note}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center border-t-2 border-black border-dashed pt-2 mt-4 mb-8">
          <div>*** END OF TICKET ***</div>
        </div>

        <PrintButton />
      </div>
    </div>
  );
}
