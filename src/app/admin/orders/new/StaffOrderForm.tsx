"use client";
import { lazy, Suspense, useReducer, useRef, useState } from "react";
import type { PublicItem, PublicMenu } from "@/lib/menu/queries";
import { cartReducer, cartCount, cartLineKey, type CartLine } from "@/lib/orders/cart";
import { MenuView } from "@/components/menu/MenuView";
import { useTranslations, useLocale } from "next-intl";
import { placeStaffOrderAction } from "./actions";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/l10n";

const ItemSheet = lazy(() => import("@/components/table/ItemSheet"));
const Cart = lazy(() => import("@/components/table/Cart"));

export function StaffOrderForm({ tables, menu }: { tables: { id: string; label: string; occupied: boolean }[]; menu: PublicMenu }) {
  const t = useTranslations("staffOrder");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const items = menu.categories.flatMap(({ items }) => items);

  const [lines, dispatch] = useReducer(cartReducer, []);
  const key = useRef<string | null>(null);
  const submitting = useRef(false);

  const [selected, setSelected] = useState<PublicItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<"TABLE" | "TAKEAWAY">("TABLE");
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");

  const buttonClass = "inline-flex min-h-touch items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:pointer-events-none disabled:opacity-50";

  function add(line: CartLine) {
    const existing = lines.find((entry) => cartLineKey(entry) === cartLineKey(line));
    if ((existing && existing.qty + line.qty > 20) || (!existing && lines.length >= 30)) { setError("Cart limit reached"); return false; }
    if (!lines.length) key.current = crypto.randomUUID();
    dispatch({ type: "add", line }); setError(null); setNotice(t("addItems")); return true;
  }

  async function place(name: string) {
    if (submitting.current || !lines.length || !key.current) return;
    if (targetType === "TABLE" && !tableId) {
      setError(t("selectTable")); return;
    }
    
    submitting.current = true; setPending(true); setError(null); setNotice(null);
    try {
      const result = await placeStaffOrderAction({
        target: targetType === "TABLE" ? { type: "TABLE", tableId } : { type: "TAKEAWAY", customerName: name },
        idempotencyKey: key.current,
        items: lines
      });
      if (!result.ok) { setError(result.error); return; }
      dispatch({ type: "clear" }); key.current = null; setCartOpen(false);
      setNotice(t("success"));
      router.push("/admin/board");
    } catch {
      setError("Failed to place order");
    } finally {
      submitting.current = false; setPending(false);
    }
  }

  return <div className="space-y-8">
    <h1 className="font-heading text-3xl text-primary">{t("title")}</h1>
    
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="targetType" value="TABLE" checked={targetType === "TABLE"} onChange={() => setTargetType("TABLE")} className="size-4" />
          {t("table")}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="targetType" value="TAKEAWAY" checked={targetType === "TAKEAWAY"} onChange={() => setTargetType("TAKEAWAY")} className="size-4" />
          {t("takeaway")}
        </label>
      </div>

      {targetType === "TABLE" && <div className="space-y-2">
        <label htmlFor="table-select" className="block font-medium">{t("selectTable")}</label>
        <select id="table-select" value={tableId} onChange={(e) => setTableId(e.target.value)} className="min-h-touch w-full rounded-md border border-muted-foreground bg-secondary px-3 py-2 text-base">
          {tables.map(table => (
            <option key={table.id} value={table.id}>
              {table.label} {table.occupied ? `(${t("tableOccupied")})` : ""}
            </option>
          ))}
        </select>
      </div>}
    </div>

    {notice && <p role="status" className="mt-4">{notice}</p>}
    {error && !cartOpen && !selected && <p role="alert" className="mt-4 break-words text-destructive">{error}</p>}

    <MenuView menu={menu} locale={locale} onAdd={(item) => { setError(null); setSelected(item); }} addText={t("addItems")} buttonClass={buttonClass} />

    {!!lines.length && <div className="cart-bar fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-6 py-3">
      <div className="mx-auto max-w-content">
        <button type="button" className={`${buttonClass} w-full`} onClick={() => setCartOpen(true)}>
          {t("review")} ({cartCount(lines)})
        </button>
      </div>
    </div>}

    <Suspense fallback={<p role="status" className="mt-4">Loading...</p>}>
      {selected && <ItemSheet key={selected.id} item={selected} items={items} locale={locale} error={error} onAdd={add} onChoose={setSelected} onClose={() => setSelected((current) => current?.id === selected.id ? null : current)} />}
      {cartOpen && <Cart lines={lines} items={items} locale={locale} pending={pending} error={error} onChange={dispatch} onPlace={place} onClose={() => {
        if (!submitting.current) setCartOpen(false);
      }} />}
    </Suspense>
  </div>;
}
