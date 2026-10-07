/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { draftCampaignAction } from "./actions";

export function CampaignUI({ eligibleCount }: { eligibleCount: number }) {
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleDraft = async () => {
    setDrafting(true);
    setError("");
    setExpanded(true);
    try {
      const res = await draftCampaignAction();
      if (res.ok && res.draft) {
        setMessage(res.draft);
      } else {
        setError(res.error || "Failed to draft campaign message.");
      }
    } catch (e) {
      setError("Failed to draft campaign message.");
    } finally {
      setDrafting(false);
    }
  };

  if (eligibleCount === 0) return null;

  return (
    <div className="bg-card rounded-lg shadow border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Marketing Campaign</h2>
          <p className="text-sm text-muted-foreground">{eligibleCount} eligible customers with marketing consent.</p>
        </div>
        <button 
          onClick={handleDraft}
          disabled={drafting}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft Campaign Message"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 pt-4 border-t">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-semibold mb-2">Campaign Message</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 border rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-y"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            To use this message, click the &quot;Send Promo&quot; button next to an eligible customer below.
            A new tab will open in WhatsApp Web with this text pre-filled.
          </p>
        </div>
      )}
    </div>
  );
}
