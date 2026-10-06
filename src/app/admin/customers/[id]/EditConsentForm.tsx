"use client";

import { useTransition, useState } from "react";
import { recordConsentAction } from "../actions";

export function EditConsentForm({ customerId, current }: { customerId: string; current?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [granted, setGranted] = useState(current || false);

  const handleSave = () => {
    startTransition(async () => {
      const res = await recordConsentAction(customerId, granted);
      if (!res.ok) alert("Failed to update consent.");
    });
  };

  return (
    <div className="flex items-center gap-4">
      <select 
        value={granted ? "YES" : "NO"} 
        onChange={e => setGranted(e.target.value === "YES")}
        className="border px-3 py-2 rounded text-sm bg-background"
      >
        <option value="YES">Granted</option>
        <option value="NO">Revoked/Denied</option>
      </select>
      <button 
        type="button"
        disabled={isPending || granted === current}
        onClick={handleSave}
        className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Update"}
      </button>
    </div>
  );
}
