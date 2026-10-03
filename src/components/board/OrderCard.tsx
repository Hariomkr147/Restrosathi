import type { BoardOrder } from "@/lib/orders/board";
import { useTranslations } from "next-intl";
import { acceptOrder, readyOrder, serveOrder } from "@/app/admin/board/actions";
import { RejectSheet } from "./RejectSheet";
import { useState, useEffect } from "react";
import { escalationLevel } from "@/lib/orders/board-logic";
import { VoidSheet } from "./VoidSheet";
import Link from "next/link";

export function OrderCard({ order, nowMs, onAction, beep }: { order: BoardOrder; nowMs: number; onAction: () => void; beep: (escalated: boolean) => void }) {
  const t = useTranslations("board");
  const escalated = escalationLevel(order, nowMs) === 1;
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    if (escalated) beep(true);
  }, [escalated, beep]); // This will beep every time nowMs updates if escalated (which is every 1s, but we only want every 10s according to spec)

  // Spec: "louder repeating beep every 10 s until accepted or rejected"
  useEffect(() => {
    if (!escalated) return;
    const interval = setInterval(() => beep(true), 10000);
    return () => clearInterval(interval);
  }, [escalated, beep]);

  return (
    <div className={`border p-4 rounded-xl flex flex-col gap-2 ${escalated ? "border-destructive bg-destructive/10" : "bg-card"}`}>
      <div className="flex justify-between font-bold">
        <span>{order.tableLabel}</span>
        <span className="text-sm text-muted-foreground">
          {Math.floor((nowMs - new Date(order.placedAt).getTime()) / 60000)}m
        </span>
      </div>
      {order.customerName && <div className="text-sm text-muted-foreground">{order.customerName}</div>}
      
      <div className="flex flex-col gap-1 my-2">
        {order.lines.map(l => (
          <div key={l.id} className={`flex justify-between items-start ${l.voided ? "line-through opacity-50" : ""}`}>
            <span>{l.qty}x {l.name} {l.variant && <span className="text-muted-foreground">({l.variant})</span>}
              {l.modifiers.length > 0 && <div className="text-xs text-muted-foreground pl-4">{l.modifiers.join(", ")}</div>}
              {l.note && <div className="text-xs italic pl-4">"{l.note}"</div>}
            </span>
            {!l.voided && (order.status === "NEW" || order.status === "PREPARING") && (
              <VoidSheet lineId={l.id} onAction={onAction} />
            )}
          </div>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t">
        {order.status === "NEW" && (
          <>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium flex-1" onClick={async () => { await acceptOrder(order.id); onAction(); }}>{t("accept")}</button>
            <button className="bg-muted px-4 py-2 rounded font-medium flex-1" onClick={() => setRejectOpen(true)}>{t("reject")}</button>
          </>
        )}
        {order.status === "PREPARING" && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium flex-1" onClick={async () => { await readyOrder(order.id); onAction(); }}>{t("ready")}</button>
        )}
        {order.status === "READY" && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium flex-1" onClick={async () => { await serveOrder(order.id); onAction(); }}>{t("served")}</button>
        )}
        {/* Task 17: <Link href={`/admin/orders/${order.id}/kot`} className="text-sm underline mt-2 w-full text-center">{t("printKOT")}</Link> */}
      </div>

      {rejectOpen && <RejectSheet orderId={order.id} onClose={() => setRejectOpen(false)} onAction={onAction} />}
    </div>
  );
}
