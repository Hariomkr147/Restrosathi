"use client";

import { useState } from "react";
import { formatINR } from "@/lib/money/format";
import { settleBillAction } from "../../../actions";
import { useRouter } from "next/navigation";

export function SettleClient({ bill }: { bill: any }) {
  const router = useRouter();
  const [split, setSplit] = useState(false);
  const [payments, setPayments] = useState([{ method: "CASH", amountPaise: bill.totalPaise }]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAdded = payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const balance = bill.totalPaise - totalAdded;

  const handleSettle = async () => {
    if (balance !== 0) return;
    setIsSubmitting(true);
    setError(null);

    const res = await settleBillAction(bill.id, payments as any, bill.totalPaise);
    if (res.ok) {
      router.push(`/admin/bills/view/${bill.id}`);
      router.refresh();
    } else {
      setError(res.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-muted rounded-lg flex justify-between items-center text-lg font-bold">
        <span>Total Due</span>
        <span>{formatINR(bill.totalPaise)}</span>
      </div>

      {!split && (
        <div className="flex gap-4">
          {["CASH", "UPI", "CARD"].map(m => (
            <button
              key={m}
              onClick={async () => {
                setIsSubmitting(true);
                const res = await settleBillAction(bill.id, [{ method: m as any, amountPaise: bill.totalPaise }], bill.totalPaise);
                if (res.ok) {
                  router.push(`/admin/bills/view/${bill.id}`);
                  router.refresh();
                } else {
                  setError(res.error);
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="flex-1 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg disabled:opacity-50"
            >
              {m} ({formatINR(bill.totalPaise)})
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input 
          type="checkbox" 
          id="split" 
          checked={split} 
          onChange={(e) => {
            setSplit(e.target.checked);
            if (!e.target.checked) setPayments([{ method: "CASH", amountPaise: bill.totalPaise }]);
          }} 
        />
        <label htmlFor="split" className="font-medium">Split payment</label>
      </div>

      {split && (
        <div className="space-y-4">
          {payments.map((p, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="flex-1 space-y-2">
                <label aria-label="Payment method">Payment method</label>
                <select
                  value={p.method}
                  onChange={(e) => {
                    const newP = [...payments];
                    newP[i].method = e.target.value;
                    setPayments(newP);
                  }}
                  className="w-full p-2 border rounded"
                  aria-label="Payment method"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                </select>
              </div>
              <div className="flex-1 space-y-2">
                <label aria-label="Amount">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={p.amountPaise / 100}
                  onChange={(e) => {
                    const newP = [...payments];
                    newP[i].amountPaise = Math.round(parseFloat(e.target.value || "0") * 100);
                    setPayments(newP);
                  }}
                  className="w-full p-2 border rounded"
                  aria-label="Amount"
                />
              </div>
            </div>
          ))}

          <button 
            type="button" 
            onClick={() => setPayments([...payments, { method: "CASH", amountPaise: balance > 0 ? balance : 0 }])}
            className="text-primary underline font-medium"
          >
            Add payment method
          </button>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-muted-foreground">Remaining</span>
            <span className={`font-bold ${balance === 0 ? "text-green-600" : balance < 0 ? "text-destructive" : ""}`}>
              {formatINR(balance)}
            </span>
          </div>

          <button 
            onClick={handleSettle} 
            disabled={balance !== 0 || isSubmitting}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/20 text-destructive rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
