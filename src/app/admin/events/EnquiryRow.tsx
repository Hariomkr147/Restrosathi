/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { adminUpdateEnquiryStatusAction } from "./actions";
import { formatINR } from "@/lib/money/format";

export function EnquiryRow({ enquiry, t }: { enquiry: any, t: Record<string, string> }) {
  const [status, setStatus] = useState(enquiry.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState(enquiry.notes || "");
  const [quoteInput, setQuoteInput] = useState(enquiry.quotedPaise ? String(enquiry.quotedPaise / 100) : "");

  const validTransitions: Record<string, string[]> = {
    NEW: ["QUOTED", "LOST"],
    QUOTED: ["CONFIRMED", "LOST"],
    CONFIRMED: [],
    LOST: [],
  };
  const available = validTransitions[status] || [];

  async function handleTransition(newStatus: string) {
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    setError(null);
    try {
      const quotePaise = newStatus === "QUOTED" && quoteInput ? Math.round(Number(quoteInput) * 100) : undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await adminUpdateEnquiryStatusAction(enquiry.id, newStatus as any, notes, quotePaise);
      if (res.ok) {
        setStatus(newStatus);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError("Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-[var(--color-border)] p-4 rounded-sm bg-surface">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold">{enquiry.name} • {enquiry.phone}</div>
          <div className="text-sm text-muted-foreground">{new Date(enquiry.eventDate).toISOString().split('T')[0]} • {enquiry.guests} {t.guests} • {enquiry.eventType}</div>
          {enquiry.package && <div className="text-sm text-primary font-bold">{enquiry.package.name?.en}</div>}
          {enquiry.message && <div className="text-sm mt-2 p-2 bg-surface-raised rounded-sm">{enquiry.message}</div>}
        </div>
        <div className="text-right">
          <div className="font-bold text-lg">{t[`status${status}`]}</div>
          {enquiry.quotedPaise && <div className="font-bold text-primary">{formatINR(enquiry.quotedPaise)}</div>}
        </div>
      </div>

      {available.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
          {error && <div className="text-danger text-sm">{error}</div>}
          
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder={t.notes} 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              className="flex-grow px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent"
            />
            {(available.includes("QUOTED") || status === "QUOTED") && (
              <input 
                type="number" 
                placeholder={t.quote} 
                value={quoteInput}
                onChange={e => setQuoteInput(e.target.value)}
                className="w-32 px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent"
              />
            )}
          </div>
          
          <div className="flex gap-2">
            {available.map(st => (
              <button 
                key={st}
                disabled={loading}
                onClick={() => handleTransition(st)}
                className="px-3 py-1 bg-surface-raised border border-[var(--color-border)] rounded-sm text-sm font-bold"
              >
                → {t[`status${st}`]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
