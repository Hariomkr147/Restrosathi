"use client";

import { useState, useRef, useEffect } from "react";
import { requestOtpAction, verifyOtpAction } from "@/app/(public)/book/otp-actions";
import { useTranslations } from "next-intl";

interface Props {
  onSuccess: (phone: string) => void;
  defaultPhone?: string;
}

export function OtpField({ onSuccess, defaultPhone = "" }: Props) {
  const [phone, setPhone] = useState(defaultPhone);
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(r => r - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (loading || resendTimer > 0) return;
    setLoading(true);
    setError("");

    const res = await requestOtpAction(phone);
    setLoading(false);
    
    if (res.ok) {
      setStep("OTP");
      setResendTimer(30);
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } else {
      setError(res.error);
    }
  }

  async function handleVerify(fullCode: string) {
    setLoading(true);
    setError("");
    const res = await verifyOtpAction(phone, fullCode);
    setLoading(false);
    
    if (res.ok) {
      onSuccess(phone);
    } else {
      setError(res.error);
      setCode(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      handleVerify(pasted);
    }
  }

  function handleChange(i: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(0, 1);
    const newCode = [...code];
    newCode[i] = digit;
    setCode(newCode);

    if (digit && i < 5) {
      inputsRef.current[i + 1]?.focus();
    }
    
    if (digit && i === 5 && !newCode.includes("")) {
      handleVerify(newCode.join(""));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      {step === "PHONE" ? (
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
              placeholder="+919999900000"
              disabled={loading}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the 6-digit code sent to {phone}
          </p>
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {code.map((c, i) => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={c}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(e, i)}
                disabled={loading}
                className="w-12 h-12 text-center text-xl rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
          
          <div className="flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={() => { setStep("PHONE"); setError(""); }}
              className="text-orange-600 hover:text-orange-500"
              disabled={loading}
            >
              Change number
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={resendTimer > 0 || loading}
              className="text-orange-600 hover:text-orange-500 disabled:text-gray-400"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
