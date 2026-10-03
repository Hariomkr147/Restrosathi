"use client";
import { useState } from "react";
import type { PublicItem } from "@/lib/menu/queries";
import type { CartLine, CartAction } from "@/lib/orders/cart";
import { localize, type Locale } from "@/lib/i18n/l10n";
import { priceLine } from "@/lib/menu/pricing";
import { formatINR } from "@/lib/money/format";
import { Sheet } from "./Sheet";
import { Quantity } from "./Quantity";
import { useTableText } from "./TableText";

export default function Cart({ lines, items, locale, pending, error, onChange, onPlace, onClose }: {
  lines: CartLine[]; items: PublicItem[]; locale: Locale; pending: boolean; error: string | null;
  onChange: (action: CartAction) => void; onPlace: (name: string) => void; onClose: () => void;
}) {
  const text = useTableText(); const [name, setName] = useState("");
  const rows = lines.map((line) => {
    const item = items.find(({ id }) => id === line.itemId);
    let price: number | null = null; if (item) try { price = priceLine(item, line) * line.qty; } catch { /* A changed choice must be removed and selected again. */ }
    return { line, item, price };
  });
  const valid = rows.every(({ item, price }) => item?.available && price !== null);
  const total = rows.reduce((sum, { price }) => sum + (price ?? 0), 0);
  return <Sheet title={text.cartTitle} busy={pending} onClose={onClose}>
    {!lines.length ? <p role="status">{text.cartEmpty}</p> : <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); if (valid && !pending) onPlace(name); }}>
      <ul>{rows.map(({ line, item, price }, index) => {
        const title = item ? localize(item.name, locale) : text.ITEM_UNAVAILABLE;
        const variant = item?.variants.find(({ id }) => id === line.variantId);
        const options = item?.modifierGroups.flatMap(({ options }) => options).filter(({ id }) => line.optionIds.includes(id)) ?? [];
        return <li key={index} className="min-w-0 space-y-3 border-b border-border py-4">
          <h3 className="break-words font-heading text-xl">{title}</h3>
          {variant && <p>{localize(variant.name, locale)}</p>}
          {!!options.length && <p className="break-words text-muted-foreground">{options.map(({ name }) => localize(name, locale)).join(", ")}</p>}
          {line.note && <p className="break-words text-muted-foreground">{line.note}</p>}
          <Quantity value={line.qty} name={title} disabled={pending} onChange={(qty) => onChange({ type: "setQty", index, qty })} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className={text.outlineClass} disabled={pending} aria-label={`${text.remove} ${title}`} onClick={() => onChange({ type: "remove", index })}>{text.remove}</button>
            {price !== null && <p className="font-medium tabular-nums">{formatINR(price)}</p>}
          </div>
        </li>;
      })}</ul>
      {!valid && <p role="alert" className="text-destructive">{text.CHOICE_INVALID}</p>}
      <div className="space-y-2"><label htmlFor="cart-name" className="block font-medium">{text.name}</label>
        <input id="cart-name" autoComplete="given-name" maxLength={60} value={name} disabled={pending} onChange={(event) => setName(event.target.value)} className="min-h-touch w-full rounded-md border border-muted-foreground bg-secondary px-3 py-2 text-base" />
      </div>
      <p data-testid="cart-total" className="flex flex-wrap justify-between gap-3 text-lg font-medium">{text.total} <span className="tabular-nums">{formatINR(total)}</span></p>
      {error && <p role="alert" className="break-words text-destructive">{error}</p>}
      <button type="submit" className={`${text.buttonClass} w-full`} disabled={pending || !valid}>{pending ? text.placingOrder : text.placeOrder}</button>
    </form>}
  </Sheet>;
}
