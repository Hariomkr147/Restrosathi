"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useTableText } from "./TableText";

export function Sheet({ title, busy = false, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const text = useTableText(); const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => { node.close(); }; }, []);
  return <dialog ref={dialog} aria-labelledby="sheet-title" aria-busy={busy} className="order-sheet overflow-y-auto rounded-t-lg border border-border bg-background p-6 text-foreground"
    onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }}>
    <div className="mb-6 flex items-start justify-between gap-4">
      <h2 id="sheet-title" className="min-w-0 break-words font-heading text-2xl">{title}</h2>
      <button type="button" autoFocus className={text.outlineClass} disabled={busy} onClick={() => dialog.current?.close()}>{text.close}</button>
    </div>
    {children}
  </dialog>;
}
