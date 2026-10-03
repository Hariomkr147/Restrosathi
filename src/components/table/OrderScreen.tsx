"use client";
import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { PublicItem, PublicMenu } from "@/lib/menu/queries";
import type { SessionView } from "@/lib/orders/session-view";
import type { Locale } from "@/lib/i18n/l10n";
import { cartReducer, cartCount, cartLineKey, type CartLine, type CartAction } from "@/lib/orders/cart";
import { placeOrderAction, serviceRequestAction } from "@/app/t/[code]/actions";
import { MenuView } from "../menu/MenuView";
import { useTableText } from "./TableText";
import { StatusTracker } from "./StatusTracker";
import { BillView } from "./BillView";

const ItemSheet = lazy(() => import("./ItemSheet"));
const Cart = lazy(() => import("./Cart"));
export function OrderScreen({ menu, locale, code, initialView }: { menu: PublicMenu; locale: Locale; code: string; initialView: SessionView }) {
  const text = useTableText(); const items = menu.categories.flatMap(({ items }) => items);
  const [lines, dispatch] = useReducer(cartReducer, []); const key = useRef<string | null>(null); const submitting = useRef(false);
  const [selected, setSelected] = useState<PublicItem | null>(null); const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState<SessionView | null>(initialView); const [pending, setPending] = useState(false);
  const [servicePending, setServicePending] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); const [statusError, setStatusError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    const timeout = setTimeout(() => request.abort(new Error("TIMEOUT")), 10_000);
    try {
      const response = await fetch(`/api/t/${encodeURIComponent(code)}/status`, { signal: request.signal, cache: "no-store" });
      if (response.status === 404) { setView(null); setStatusError(text.TABLE_NOT_FOUND); return false; }
      if (!response.ok) throw new Error("STATUS_UNAVAILABLE");
      const next = await response.json() as SessionView;
      if (request.signal.aborted) return false;
      setView(next); setStatusError(null); return true;
    } catch { if (!request.signal.aborted || (request.signal.reason as Error)?.message === "TIMEOUT") setStatusError(text.statusError); return false; }
    finally { clearTimeout(timeout); }
  }, [code, text.TABLE_NOT_FOUND, text.statusError]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>; let disposed = false; let generation = 0; let delay = 3000;
    const poll = async () => {
      if (disposed || document.hidden) return;
      const current = ++generation; const ok = await refresh();
      if (disposed || document.hidden || current !== generation) return;
      delay = ok ? 3000 : Math.min(delay * 2, 30_000); timer = setTimeout(poll, delay);
    };
    const visibility = () => { ++generation; clearTimeout(timer); controller.current?.abort(); if (!document.hidden) { delay = 3000; void poll(); } };
    timer = setTimeout(poll, delay); document.addEventListener("visibilitychange", visibility);
    return () => { disposed = true; ++generation; clearTimeout(timer); controller.current?.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, [refresh]);
  function add(line: CartLine) {
    const existing = lines.find((entry) => cartLineKey(entry) === cartLineKey(line));
    if ((existing && existing.qty + line.qty > 20) || (!existing && lines.length >= 30)) { setError(text.cartLimit); return false; }
    if (!lines.length) key.current = crypto.randomUUID();
    dispatch({ type: "add", line }); setError(null); setNotice(text.added); return true;
  }
  function change(action: CartAction) { dispatch(action); setError(null); setNotice(null); }
  async function place(name: string) {
    if (submitting.current || !lines.length || !key.current) return;
    submitting.current = true; setPending(true); setError(null); setNotice(null);
    try {
      const result = await placeOrderAction({ tableCode: code, idempotencyKey: key.current, customerName: name, items: lines });
      if (!result.ok) { setError(text[result.error]); return; }
      dispatch({ type: "clear" }); key.current = null; setCartOpen(false);
      await refresh();
      const heading = document.getElementById("orders-heading");
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } catch { setError(text.orderError); }
    finally { submitting.current = false; setPending(false); }
  }
  async function request(kind: "CALL_WAITER" | "REQUEST_BILL") {
    if (servicePending) return;
    setServicePending(kind); setError(null);
    try {
      const result = await serviceRequestAction(code, kind);
      if (!result.ok) { setError(text[result.error]); return; }
      await refresh();
    } catch { setError(text.serviceError); }
    finally { setServicePending(null); }
  }
  return <>
    <MenuView menu={menu} locale={locale} onAdd={(item) => { setError(null); setSelected(item); }} addText={text.add} buttonClass={text.buttonClass} />
    {notice && <p role="status" className="mt-4">{notice}</p>}
    {error && !cartOpen && !selected && <p role="alert" className="mt-4 break-words text-destructive">{error}</p>}
    {statusError && <p role="status" className="mt-4 break-words text-muted-foreground">{statusError}</p>}
    <StatusTracker orders={view?.orders ?? []} locale={locale} />
    <div className="mt-6 flex flex-wrap gap-3">
      <button type="button" className={text.outlineClass} disabled={!!servicePending || view?.openRequests.includes("CALL_WAITER")} onClick={() => void request("CALL_WAITER")}>{view?.openRequests.includes("CALL_WAITER") ? text.waiterRequested : servicePending === "CALL_WAITER" ? text.requesting : text.callWaiter}</button>
      <button type="button" className={text.outlineClass} disabled={!!servicePending || view?.openRequests.includes("REQUEST_BILL")} onClick={() => void request("REQUEST_BILL")}>{view?.openRequests.includes("REQUEST_BILL") ? text.billRequested : servicePending === "REQUEST_BILL" ? text.requesting : text.requestBill}</button>
    </div>
    <BillView view={view} locale={locale} />
    {!!lines.length && <div className="cart-bar fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-6 py-3">
      <div className="mx-auto max-w-content"><button type="button" className={`${text.buttonClass} w-full`} onClick={() => setCartOpen(true)}>{text.viewCart} ({cartCount(lines)})</button></div>
    </div>}
    <Suspense fallback={<p role="status" className="mt-4">{text.loading}</p>}>
      {selected && <ItemSheet key={selected.id} item={selected} items={items} locale={locale} error={error} onAdd={add} onChoose={setSelected} onClose={() => setSelected((current) => current?.id === selected.id ? null : current)} />}
      {cartOpen && <Cart lines={lines} items={items} locale={locale} pending={pending} error={error} onChange={change} onPlace={(name) => void place(name)} onClose={() => {
        if (submitting.current) return;
        setCartOpen(false);
        if (!lines.length) document.getElementById("table-heading")?.focus({ preventScroll: true });
      }} />}
    </Suspense>
  </>;
}
