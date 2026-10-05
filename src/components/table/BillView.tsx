"use client";
import type { SessionView } from "@/lib/orders/session-view";
import { localize, type Locale } from "@/lib/i18n/l10n";
import { formatINR } from "@/lib/money/format";
import { useTableText } from "./TableText";

export function BillView({ view, locale }: { view: SessionView | null; locale: Locale }) {
  const text = useTableText(); 
  
  if (view?.bill) {
    const { title, lines, subtotalPaise, discountPaise, taxLines, roundOffPaise, totalPaise } = view.bill;
    return <section className="mt-10 space-y-4" aria-labelledby="bill-heading">
      <h2 id="bill-heading" className="font-heading text-2xl">{title}</h2>
      {!lines.length && <p>{text.billEmpty}</p>}
      <ul className="space-y-3">{lines.map((line, index) => <li key={index} className="flex min-w-0 flex-wrap justify-between gap-3 border-b border-border py-3">
        <span className="min-w-0 break-words">{line.qty} × {line.name}</span>
        <span className="font-medium tabular-nums">{formatINR(line.totalPaise)}</span>
      </li>)}</ul>
      <div className="space-y-2 border-b border-border py-3 text-muted-foreground">
        <div className="flex justify-between gap-4"><span>{text.billSubtotal}</span><span className="tabular-nums">{formatINR(subtotalPaise)}</span></div>
        {discountPaise > 0 && <div className="flex justify-between gap-4"><span>{text.billDiscount}</span><span className="tabular-nums">-{formatINR(discountPaise)}</span></div>}
        {taxLines.map((tax, i) => <div key={i} className="flex justify-between gap-4"><span>{tax.label}</span><span className="tabular-nums">{formatINR(tax.amountPaise)}</span></div>)}
        {roundOffPaise !== 0 && <div className="flex justify-between gap-4"><span>{text.billRoundOff}</span><span className="tabular-nums">{formatINR(roundOffPaise)}</span></div>}
      </div>
      <div className="flex justify-between gap-4 py-3">
        <span className="text-xl font-medium">{text.billTotal}</span>
        <span className="text-2xl font-medium tabular-nums">{formatINR(totalPaise)}</span>
      </div>
    </section>;
  }

  const lines = view?.orders.filter(({ status }) => status !== "REJECTED").flatMap(({ lines }) => lines).filter(({ voided }) => !voided) ?? [];
  return <section className="mt-10 space-y-4" aria-labelledby="bill-heading">
    <h2 id="bill-heading" className="font-heading text-2xl">{text.amountSoFar}</h2>
    {!lines.length && <p>{text.billEmpty}</p>}
    <ul className="space-y-3">{lines.map((line, index) => <li key={index} className="flex min-w-0 flex-wrap justify-between gap-3 border-b border-border py-3">
      <span className="min-w-0 break-words">{line.qty} × {localize(line.name, locale)}{line.variant && ` — ${localize(line.variant, locale)}`}</span>
      <span className="font-medium tabular-nums">{formatINR(line.linePaise)}</span>
    </li>)}</ul>
    <p className="text-2xl font-medium tabular-nums">{formatINR(view?.amountPaise ?? 0)}</p>
  </section>;
}
