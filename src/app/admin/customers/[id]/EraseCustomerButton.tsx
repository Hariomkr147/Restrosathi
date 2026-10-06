"use client";

import { useTransition } from "react";
import { eraseCustomerAction } from "../actions";
import { useRouter } from "next/navigation";

export function EraseCustomerButton({ customerId }: { customerId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleErase = () => {
    if (!confirm("Are you sure you want to erase all personal data for this customer? This will clear name, phone, messages, and bookings, and cannot be undone.")) return;
    
    startTransition(async () => {
      const res = await eraseCustomerAction(customerId);
      if (res.ok) {
        router.push("/admin/customers");
      } else {
        alert("Failed to erase customer data.");
      }
    });
  };

  return (
    <button 
      type="button"
      disabled={isPending}
      onClick={handleErase}
      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded text-sm disabled:opacity-50"
    >
      {isPending ? "Erasing..." : "Erase Personal Data"}
    </button>
  );
}
