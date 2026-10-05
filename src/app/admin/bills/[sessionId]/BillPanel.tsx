"use client";

import { useState } from "react";
import { formatINR } from "@/lib/money/format";
import { generateBillAction } from "../actions";
import { useFormStatus } from "react-dom";

function SubmitButton({ isRecalculate, disabled }: { isRecalculate: boolean, disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
      {pending ? "Generating..." : isRecalculate ? "Recalculate Bill" : "Generate Bill"}
    </button>
  );
}

export function BillPanel({ sessionId, bill, lines, computed, settings, userRole }: any) {
  const [error, setError] = useState<string | null>(null);
  
  const canDiscount = userRole === "OWNER" || settings.staffCanDiscount;
  
  const hasUnaccepted = lines.some((l: any) => l.order?.status === "NEW");
  
  async function action(formData: FormData) {
    setError(null);
    const dType = formData.get("discountType") as string;
    const dValue = formData.get("discountValue") as string;
    const dReason = formData.get("discountReason") as string;
    
    let discount = undefined;
    if (dType && dValue && dReason) {
      discount = {
        type: dType as "FLAT" | "PERCENT",
        value: parseInt(dValue, 10),
        reason: dReason
      };
    }
    
    const res = await generateBillAction(sessionId, {
      customerName: formData.get("customerName") as string || undefined,
      customerPhone: formData.get("customerPhone") as string || undefined,
      discount
    });
    
    if (!res.ok) {
      setError(res.error);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">Bill Lines</h2>
          {hasUnaccepted && (
            <div className="mb-4 rounded bg-destructive/15 p-3 text-sm text-destructive">
              There are unaccepted orders. Please accept or reject them first.
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="pb-2">Item</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l: any, i: number) => (
                <tr key={i}>
                  <td className="py-3">
                    <p className="font-medium">{l.nameSnapshot?.en || l.name?.en}</p>
                    {l.variantSnapshot?.en && <p className="text-xs text-muted-foreground">{l.variantSnapshot.en}</p>}
                  </td>
                  <td className="py-3 text-right">{l.qty}</td>
                  <td className="py-3 text-right">{formatINR(l.unitPricePaise)}</td>
                  <td className="py-3 text-right">{formatINR(l.qty * l.unitPricePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <form action={action} className="rounded-lg border bg-card p-4 space-y-4">
          <h2 className="text-lg font-semibold">Bill Details</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Name</label>
              <input name="customerName" type="text" className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Phone</label>
              <input name="customerPhone" type="tel" className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>
          
          {canDiscount && (
            <div className="space-y-4 rounded-md border bg-accent/20 p-4">
              <h3 className="text-sm font-medium">Apply Discount</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <select name="discountType" aria-label="Discount Type" className="rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="">None</option>
                  <option value="FLAT">Flat Amount</option>
                  <option value="PERCENT">Percentage</option>
                </select>
                <input name="discountValue" aria-label="Discount Value" type="number" min="1" className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Value" />
                <input name="discountReason" aria-label="Discount Reason" type="text" className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Reason (Required)" />
              </div>
            </div>
          )}
          
          {error && <div className="text-sm text-destructive">{error}</div>}
          
          <div className="flex justify-end pt-4">
            <SubmitButton isRecalculate={!!bill} disabled={hasUnaccepted} />
          </div>
        </form>
      </div>
      
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(computed.subtotalPaise)}</span>
            </div>
            {computed.discountPaise > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-500">
                <span>Discount</span>
                <span>-{formatINR(computed.discountPaise)}</span>
              </div>
            )}
            {settings.taxMode === "REGULAR" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Value</span>
                  <span>{formatINR(computed.taxableValuePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST</span>
                  <span>{formatINR(computed.cgstPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST</span>
                  <span>{formatINR(computed.sgstPaise)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Round Off</span>
              <span>{formatINR(computed.roundOffPaise)}</span>
            </div>
            <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
              <span>Total</span>
              <span>{formatINR(computed.totalPaise)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
