"use client";
import type { SessionView } from "@/lib/orders/session-view";
import { localize, type Locale } from "@/lib/i18n/l10n";
import { useTableText } from "./TableText";

export function StatusTracker({ orders, locale }: { orders: SessionView["orders"]; locale: Locale }) {
  const text = useTableText();
  return <section className="mt-10 space-y-4" aria-labelledby="orders-heading">
    <h2 id="orders-heading" tabIndex={-1} className="font-heading text-2xl">{text.orders}</h2>
    <p className="break-words text-sm text-muted-foreground">{text.progress}</p>
    {!orders.length && <p>{text.noOrders}</p>}
    <ul aria-live="polite">{orders.map((order) => <li key={order.id} className="min-w-0 space-y-3 border-b border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={`font-heading text-xl ${order.status === "REJECTED" ? "text-destructive" : "text-primary"}`}>{text[order.status]}</h3>
        <time dateTime={order.placedAt} className="text-sm tabular-nums text-muted-foreground">{new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(order.placedAt))}</time>
      </div>
      {order.rejectReason && <p className="break-words text-destructive">{order.rejectReason}</p>}
      <ul className="space-y-2">{order.lines.map((line, index) => <li key={index} className="break-words">
        {line.qty} × {localize(line.name, locale)}{line.variant && ` — ${localize(line.variant, locale)}`}
        {!!line.modifiers.length && <p className="text-sm text-muted-foreground">{line.modifiers.map((name) => localize(name, locale)).join(", ")}</p>}
        {line.note && <p className="text-sm text-muted-foreground">{line.note}</p>}
        {line.voided && <p className="text-sm text-destructive">{text.voided}</p>}
      </li>)}</ul>
    </li>)}</ul>
  </section>;
}
