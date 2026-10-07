/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { draftReplyAction } from "./actions";

export function DraftReplyButton({ feedbackId, phone }: { feedbackId: string, phone: string }) {
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  const handleDraft = async () => {
    setDrafting(true);
    setError("");
    try {
      const res = await draftReplyAction(feedbackId);
      if (res.ok && res.draft) {
        // Open wa.me with drafted text
        const text = encodeURIComponent(res.draft);
        // Ensure phone is E164 without the '+' for wa.me
        const waPhone = phone.replace("+", "");
        window.open(`https://wa.me/${waPhone}?text=${text}`, "_blank");
      } else {
        setError(res.error || "Failed to draft reply");
      }
    } catch (e) {
      setError("Failed to draft reply");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-3">
      <button 
        onClick={handleDraft}
        disabled={drafting}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold disabled:opacity-50"
      >
        {drafting ? "Drafting..." : "Draft WhatsApp Reply"}
      </button>
      {error && <span className="text-red-600 text-sm">{error}</span>}
    </div>
  );
}
