"use client";
import { useState } from "react";
import type { PublicItem } from "@/lib/menu/queries";
import type { CartLine } from "@/lib/orders/cart";
import { priceLine } from "@/lib/menu/pricing";
import { localize, type Locale } from "@/lib/i18n/l10n";
import { formatINR } from "@/lib/money/format";
import { useTableText } from "./TableText";
import { Sheet } from "./Sheet";
import { Quantity } from "./Quantity";

export default function ItemSheet({ item, items, locale, error, onAdd, onChoose, onClose }: { item: PublicItem; items: PublicItem[]; locale: Locale; error: string | null; onAdd: (line: CartLine) => boolean; onChoose: (item: PublicItem) => void; onClose: () => void }) {
  const text = useTableText(); const [variantId, setVariantId] = useState<string>(); const [optionIds, setOptionIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1); const [note, setNote] = useState("");
  let price: number | null = null; try { price = priceLine(item, { variantId, optionIds }); } catch { /* Choices remain incomplete until the diner selects them. */ }
  const pairings = items.filter((entry) => entry.available && item.pairingIds?.includes(entry.id));
  return <Sheet title={localize(item.name, locale)} onClose={onClose}>
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); if (price !== null && Number.isInteger(qty) && qty >= 1 && qty <= 20 && onAdd({ itemId: item.id, variantId, optionIds, qty, note })) onClose(); }}>
      {!!item.variants.length && <fieldset className="space-y-2"><legend className="mb-2 font-medium">{text.portion}</legend>
        {item.variants.map((variant) => <label key={variant.id} className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2">
          <input type="radio" name="portion" value={variant.id} checked={variantId === variant.id} onChange={() => setVariantId(variant.id)} />
          <span className="min-w-0 break-words">{localize(variant.name, locale)} — {formatINR(variant.pricePaise)}</span>
        </label>)}
      </fieldset>}
      {item.modifierGroups.map((group) => <fieldset key={group.id} className="space-y-2"><legend className="mb-2 break-words font-medium">{localize(group.name, locale)} ({text.choose} {group.min}–{group.max})</legend>
        {group.options.map((option) => <label key={option.id} className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2">
          <input type="checkbox" checked={optionIds.includes(option.id)} onChange={(event) => setOptionIds((ids) => event.target.checked ? [...ids, option.id] : ids.filter((id) => id !== option.id))} />
          <span className="min-w-0 break-words">{localize(option.name, locale)} — {formatINR(option.priceDeltaPaise)}</span>
        </label>)}
      </fieldset>)}
      <Quantity value={qty} onChange={setQty} />
      <div className="space-y-2"><label htmlFor="item-note" className="block font-medium">{text.note}</label>
        <textarea id="item-note" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} className="min-h-touch w-full rounded-md border border-muted-foreground bg-secondary px-3 py-2 text-base" />
      </div>
      {price === null ? <p role="status" className="text-muted-foreground">{text.choiceHint}</p> : <p className="text-lg font-medium tabular-nums">{!Number.isInteger(qty) || qty < 1 ? "—" : formatINR(price * qty)}</p>}
      {error && <p role="alert" className="break-words text-destructive">{error}</p>}
      <button type="submit" className={`${text.buttonClass} w-full`} disabled={price === null || !Number.isInteger(qty) || qty < 1 || qty > 20}>{text.addToCart}</button>
      {!!pairings.length && <div className="space-y-3"><h3 className="font-heading text-xl">{text.goesWell}</h3>
        <div className="flex flex-wrap gap-2">{pairings.map((entry) => <button type="button" key={entry.id} className={text.outlineClass} onClick={() => onChoose(entry)}>{text.add} {localize(entry.name, locale)}</button>)}</div>
      </div>}
    </form>
  </Sheet>;
}
