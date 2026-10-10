/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { formatINR } from "@/lib/money/format";
import { generateBillAction, verifyBillPhoneAction, applyRedemptionAction, removeRedemptionAction } from "../actions";
import { requestOtpAction } from "@/app/(public)/book/actions";
import { useFormStatus } from "react-dom";

function SubmitButton({ isRecalculate, disabled }: { isRecalculate: boolean, disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
      {pending ? "Generating..." : isRecalculate ? "Recalculate Bill" : "Generate Bill"}
    </button>
  );
}

                                                                                     
export function BillPanel({ sessionId, bill, lines, computed, settings, userRole, marketingText, customerPointsBalance }: any) {
  const [error, setError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState(bill?.customerPhone || "");
  const [customerName, setCustomerName] = useState(bill?.customerName || "");
  const [marketingConsent, setMarketingConsent] = useState(bill?.marketingConsent || false);
  
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isPendingOtp, startOtpTransition] = useTransition();
  
  const canDiscount = userRole === "OWNER" || settings.staffCanDiscount;
  
                                        
  const hasUnaccepted = lines.some((l: any) => l.order?.status === "NEW");
  
  async function action(formData: FormData) {
    setError(null);
    const dType = formData.get("discountType") as string;
    const dValue = formData.get("discountValue") as string;
    const dReason = formData.get("discountReason") as string;
    
    let discount: { type: "FLAT" | "PERCENT"; value: number; reason: string } | null = null;
    if (dType && dValue && dReason) {
      discount = {
        type: dType as "FLAT" | "PERCENT",
        value: parseInt(dValue, 10),
        reason: dReason
      };
    }
    
    const res = await generateBillAction(sessionId, {
      customerName: customerName || undefined,
      customerPhone,
      marketingConsent,
      discount: canDiscount ? discount : undefined
    });
    
    if (!res.ok) {
      setError(res.error);
    }
  }

  const handleSendOtp = () => {
    if (!customerPhone) return;
    setOtpError(null);
    startOtpTransition(async () => {
      const res = await requestOtpAction(customerPhone);
      if (res.ok) setOtpSent(true);
      else setOtpError("Failed to send OTP");
    });
  };

  const handleVerifyOtp = () => {
    if (!bill?.id || !customerPhone || !otpCode) return;
    setOtpError(null);
    startOtpTransition(async () => {
      const res = await verifyBillPhoneAction(bill.id, customerPhone, otpCode);
      if (res.ok) {
        setOtpSent(false);
        setOtpCode("");
      } else {
        setOtpError("Invalid or expired OTP");
      }
    });
  };

  const [redeemPoints, setRedeemPoints] = useState<number>(settings.loyaltyRedeemUnitPoints || 100);
  const handleApplyRedemption = () => {
    if (!bill?.id) return;
    startOtpTransition(async () => {
      try {
        await applyRedemptionAction(bill.id, redeemPoints);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message || "Failed to apply redemption");
      }
    });
  };

  const handleRemoveRedemption = () => {
    if (!bill?.id) return;
    startOtpTransition(async () => {
      try {
        await removeRedemptionAction(bill.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message || "Failed to remove redemption");
      }
    });
  };

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
              { }
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
              <input name="customerName" type="text" className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Optional" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Phone</label>
              <div className="flex gap-2">
                <input name="customerPhone" type="tel" className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Optional" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                {bill?.id && customerPhone && customerPhone === bill.customerPhone && !bill.phoneVerifiedAt && (
                  <button type="button" onClick={handleSendOtp} disabled={isPendingOtp} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm whitespace-nowrap">
                    {isPendingOtp ? "Wait..." : "Send OTP"}
                  </button>
                )}
                {bill?.phoneVerifiedAt && customerPhone === bill.customerPhone && (
                  <div className="px-3 py-2 text-green-600 text-sm font-medium flex items-center whitespace-nowrap">
                    Verified
                  </div>
                )}
              </div>
              {otpSent && (
                <div className="flex gap-2 mt-2">
                  <input type="text" placeholder="000000" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm text-center tracking-widest" />
                  <button type="button" onClick={handleVerifyOtp} disabled={isPendingOtp || otpCode.length !== 6} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
                    Verify
                  </button>
                </div>
              )}
              {otpError && <div className="text-xs text-destructive">{otpError}</div>}
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <input type="checkbox" id="marketingConsent" name="marketingConsent" className="mt-1" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} />
            <label htmlFor="marketingConsent" className="text-sm">
              {marketingText}
            </label>
          </div>
          
          {canDiscount && (
            <div className="space-y-4 rounded-md border bg-accent/20 p-4">
              <h3 className="text-sm font-medium">Apply Discount</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <select name="discountType" aria-label="Discount Type" defaultValue={bill?.discountType ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="">None</option>
                  <option value="FLAT">Flat Amount</option>
                  <option value="PERCENT">Percentage</option>
                </select>
                <input name="discountValue" aria-label="Discount Value" type="number" min="1" defaultValue={bill?.discountValue ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Value" />
                <input name="discountReason" aria-label="Discount Reason" type="text" defaultValue={bill?.discountReason ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Reason (Required)" />
              </div>
            </div>
          )}
          
          {error && <div className="text-sm text-destructive">{error}</div>}
          
          <div className="flex justify-end pt-4">
            <SubmitButton isRecalculate={!!bill} disabled={hasUnaccepted} />
          </div>
        </form>
        
        {settings.loyaltyEnabled && bill?.id && bill?.customerPhone && bill?.phoneVerifiedAt && customerPointsBalance !== null && customerPointsBalance !== undefined && (
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <h2 className="text-lg font-semibold">Saffron Rewards</h2>
            <div className="text-sm">
              Current Balance: <span className="font-bold text-orange-600">{customerPointsBalance} pts</span>
            </div>
            
            {bill.loyaltyPointsRedeemed > 0 ? (
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-md">
                <span className="text-sm text-orange-800">Redeemed <strong>{bill.loyaltyPointsRedeemed} pts</strong> (-{formatINR(bill.loyaltyDiscountPaise)})</span>
                <button type="button" onClick={handleRemoveRedemption} disabled={isPendingOtp} className="text-sm px-3 py-1 bg-white text-orange-600 border border-orange-200 rounded hover:bg-orange-50 disabled:opacity-50">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  className="rounded-md border bg-background px-3 py-2 text-sm w-32" 
                  value={redeemPoints}
                  onChange={e => setRedeemPoints(parseInt(e.target.value) || 0)}
                  min={settings.loyaltyRedeemUnitPoints}
                  step={settings.loyaltyRedeemUnitPoints}
                />
                <button 
                  type="button" 
                  onClick={handleApplyRedemption}
                  disabled={isPendingOtp || customerPointsBalance < redeemPoints}
                  className="rounded-md bg-orange-600 text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-orange-700"
                >
                  Redeem Points
                </button>
              </div>
            )}
          </div>
        )}
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
