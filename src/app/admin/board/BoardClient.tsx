"use client";
import type { BoardOrder, BoardRequest } from "@/lib/orders/board";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { OrderCard } from "@/components/board/OrderCard";
import { ServiceRequests } from "@/components/board/ServiceRequests";
import { announce, newOrderIds, staleness } from "@/lib/orders/board-logic";

export function BoardClient({ initialData }: { initialData: { now: string; orders: BoardOrder[]; requests: BoardRequest[] } }) {
  const t = useTranslations("board");
  const [data, setData] = useState(initialData);
  const [shiftStarted, setShiftStarted] = useState(false);
  const [kitchenView, setKitchenView] = useState(false);
  const [lastOkMs, setLastOkMs] = useState(Date.now());
  const [nowMs, setNowMs] = useState(Date.now());
  const [announcement, setAnnouncement] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/board");
      if (!res.ok) throw new Error("Failed");
      const newData = await res.json();
      
      const newOrders = newOrderIds(data.orders, newData.orders);
      const newReqs = newOrderIds(data.requests as any, newData.requests as any); // just using ids
      
      if (newOrders.length > 0 || newReqs.length > 0) {
        setAnnouncement(announce(newOrders.length, newReqs.length, {
          newOrder1: t("newOrder1"), newOrderN: t("newOrderN"),
          newRequest1: t("newRequest1"), newRequestN: t("newRequestN")
        }));
        beep();
      }
      
      setData(newData);
      setLastOkMs(Date.now());
    } catch (e) {
      // Handle silently, staleness will catch it
    }
  }, [data, t]);

  useEffect(() => {
    if (!shiftStarted) return;
    const interval = setInterval(fetchBoard, 3000);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchBoard();
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    
    return () => {
      clearInterval(interval);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [shiftStarted, fetchBoard]);

  const requestWakeLock = async () => {
    try {
      if (navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (e) {}
  };

  const startShift = () => {
    setShiftStarted(true);
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current?.resume();
    requestWakeLock();
  };

  const beep = (escalated = false) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(escalated ? 880 : 440, ctx.currentTime);
    osc.frequency.setValueAtTime(escalated ? 1108 : 554, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(escalated ? 1 : 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  };

  const isStale = staleness(lastOkMs, nowMs) === "stale";
  
  if (!shiftStarted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <button onClick={startShift} className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-medium text-lg">
          {t("startShift")}
        </button>
      </div>
    );
  }

  if (kitchenView) {
    const active = data.orders.filter(o => o.status === "NEW" || o.status === "PREPARING");
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t("kitchenView")}</h2>
          <button onClick={() => setKitchenView(false)} className="underline">{t("title")}</button>
        </div>
        <div className="text-xl space-y-2">
          {active.flatMap(o => o.lines).map(l => (
            <div key={l.id} className={l.voided ? "line-through opacity-50" : ""}>
              {l.qty}x {l.name} {l.variant && `(${l.variant})`}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const columns = ["NEW", "PREPARING", "READY", "SERVED"] as const;
  const [activeTab, setActiveTab] = useState<typeof columns[number]>("NEW");

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      <div className="visually-hidden" aria-live="polite">{announcement}</div>
      <div className={`p-2 text-center text-sm flex-shrink-0 flex items-center justify-center gap-4 ${isStale ? "bg-destructive text-destructive-foreground" : "bg-muted"}`}>
        <span>{isStale ? t("stale") : `Updated ${Math.floor((nowMs - lastOkMs) / 1000)}s ago`}</span>
        <button onClick={() => setKitchenView(true)} className="underline font-medium">{t("kitchenView")}</button>
      </div>
      <div className="flex-shrink-0">
        <ServiceRequests requests={data.requests} onResolved={fetchBoard} />
      </div>

      {/* Mobile Tabs */}
      <div className="flex md:hidden border-b flex-shrink-0">
        {columns.map(status => {
          const count = data.orders.filter(o => o.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`flex-1 py-3 text-sm font-bold border-b-2 ${activeTab === status ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {t(`statuses.${status}`)} ({count})
            </button>
          );
        })}
      </div>
      
      <div className="flex-1 overflow-x-auto p-4 gap-4 flex flex-col md:flex-row h-full">
        {columns.map(status => (
          <div key={status} className={`flex-1 min-w-0 md:min-w-[300px] flex-col gap-4 overflow-y-auto ${activeTab === status ? "flex" : "hidden md:flex"}`}>
            <h3 className="font-bold border-b pb-2 hidden md:block sticky top-0 bg-background z-10">{t(`statuses.${status}`)} ({data.orders.filter(o => o.status === status).length})</h3>
            {data.orders.filter(o => o.status === status).map(o => (
              <OrderCard key={o.id} order={o} nowMs={nowMs} onAction={fetchBoard} beep={beep} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
