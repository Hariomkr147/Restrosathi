"use client";

import { useEffect, useState } from "react";
import { OtpField } from "../otp/OtpField";
import { linkPhoneToSessionAction, getSessionLoyaltyBalanceAction } from "@/app/t/[code]/actions";

interface Props {
  code: string;
  customerPhone: string | null;
  onJoined: () => void;
}

export function JoinRewards({ code, customerPhone, onJoined }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  
  useEffect(() => {
    if (customerPhone) {
      getSessionLoyaltyBalanceAction(customerPhone).then(setBalance);
    }
  }, [customerPhone]);

  if (customerPhone) {
    return (
      <div className="mt-8 rounded-xl bg-card p-6 shadow-sm border border-border">
        <h2 className="font-heading text-xl text-primary mb-2">Saffron Rewards</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You are earning points on this order as <strong>{customerPhone}</strong>.
        </p>
        <div className="bg-secondary/20 p-4 rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium">Your Balance</span>
          <span className="text-2xl font-bold text-orange-600">{balance ?? "..."} pts</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl bg-card p-6 shadow-sm border border-border">
      <h2 className="font-heading text-xl text-primary mb-2">Join Saffron Rewards</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Enter your phone number to earn points on this order.
      </p>
      
      <OtpField 
        onSuccess={onJoined} 
        onVerify={async (phone, otp) => {
          const res = await linkPhoneToSessionAction(code, phone, otp);
          if (!res.ok) return { ok: false, error: res.error };
          return { ok: true, phone };
        }}
      />
    </div>
  );
}
