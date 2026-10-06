"use client";

import { useState, useEffect } from "react";
import { submitBooking, getBookingSlots, requestOtpAction, verifyOtpAction } from "./actions";
import Link from "next/link";

type Slot = { time: string; isFull: boolean };

export function BookingForm({ maxPartySize, marketingText }: { maxPartySize: number; marketingText: string }) {
  const [dateStr, setDateStr] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 330); // IST approx
    return d.toISOString().slice(0, 10);
  });
  
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [partySize, setPartySize] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  
  const [step, setStep] = useState<"FORM" | "OTP" | "SUCCESS">("FORM");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    setSelectedSlot(null);
    getBookingSlots(dateStr).then(res => {
      if (active) {
        setSlots(res);
        setLoadingSlots(false);
      }
    });
    return () => { active = false; };
  }, [dateStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !name || !phone) return;
    
    setError(null);
    setSubmitting(true);
    const res = await submitBooking({
      name,
      phone,
      partySize,
      slotStart: selectedSlot,
      note: note || undefined,
      marketingConsent
    });
    setSubmitting(false);

    if (res.ok) {
      setStep("SUCCESS");
    } else {
      if (res.error === "OTP_REQUIRED") {
        setSubmitting(true);
        const otpRes = await requestOtpAction(phone);
        setSubmitting(false);
        if (!otpRes.ok) {
          setError(otpRes.error === "RATE_LIMITED" ? "Too many OTP requests. Please try again later." : "Invalid phone number.");
        } else {
          setStep("OTP");
        }
      } else if (res.error === "DUPLICATE_REQUEST") {
        setError("You already have a request for this time.");
      } else if (res.error === "RATE_LIMITED") {
        setError("Too many booking requests. Please try again later.");
      } else if (res.error === "PARTY_TOO_LARGE") {
        setError(`Maximum party size is ${maxPartySize}. Please call us for larger groups.`);
      } else {
        setError("Sorry, this time slot is no longer available.");
        // Refresh slots
        getBookingSlots(dateStr).then(setSlots);
        setSelectedSlot(null);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await verifyOtpAction(phone, otpCode);
    if (!res.ok) {
      setSubmitting(false);
      if (res.error === "TOO_MANY_ATTEMPTS") setError("Too many failed attempts. Please request a new code.");
      else if (res.error === "EXPIRED") setError("Code expired. Please request a new code.");
      else setError("Invalid code.");
      return;
    }
    
    // OTP verified, submit booking again
    const bookRes = await submitBooking({
      name,
      phone,
      partySize,
      slotStart: selectedSlot!,
      note: note || undefined,
      marketingConsent
    });
    setSubmitting(false);
    
    if (bookRes.ok) {
      setStep("SUCCESS");
    } else {
      setStep("FORM");
      if (bookRes.error === "DUPLICATE_REQUEST") setError("You already have a request for this time.");
      else if (bookRes.error === "RATE_LIMITED") setError("Too many booking requests. Please try again later.");
      else if (bookRes.error === "PARTY_TOO_LARGE") setError(`Maximum party size is ${maxPartySize}.`);
      else {
        setError("Sorry, this time slot is no longer available.");
        getBookingSlots(dateStr).then(setSlots);
        setSelectedSlot(null);
      }
    }
  };

  if (step === "SUCCESS") {
    return (
      <div className="bg-white p-6 rounded shadow text-center">
        <h2 className="text-2xl font-bold text-green-600 mb-4">Request Received!</h2>
        <p className="mb-4">We will confirm your booking on WhatsApp shortly.</p>
        <button onClick={() => {
          setStep("FORM");
          setSelectedSlot(null);
          setNote("");
        }} className="text-[var(--color-primary)] font-medium">Book another table</button>
      </div>
    );
  }

  if (step === "OTP") {
    return (
      <form onSubmit={handleVerifyOtp} className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Verify Phone</h2>
        <p className="mb-4 text-sm text-gray-600">Enter the 6-digit code sent to {phone}</p>
        
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
        
        <input 
          type="text" 
          value={otpCode}
          onChange={e => setOtpCode(e.target.value)}
          placeholder="000000"
          className="w-full p-3 border rounded mb-4 text-center text-xl tracking-widest"
          maxLength={6}
          required
        />
        
        <button 
          disabled={submitting || otpCode.length !== 6}
          type="submit"
          className="w-full bg-[var(--color-primary)] text-white p-3 rounded font-medium disabled:opacity-50"
        >
          {submitting ? "Verifying..." : "Verify & Book"}
        </button>
        <button 
          type="button" 
          onClick={() => setStep("FORM")}
          className="w-full mt-4 text-gray-500 text-sm"
        >
          Back
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-6">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input 
          type="date" 
          value={dateStr}
          onChange={e => setDateStr(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          max={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Time</label>
        {loadingSlots ? (
          <div className="text-sm text-gray-500">Loading times...</div>
        ) : slots.length === 0 ? (
          <div className="text-sm text-gray-500">No tables available on this date.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map(s => {
              const d = new Date(s.time);
              const timeLabel = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
              return (
                <button
                  key={s.time}
                  type="button"
                  data-testid="slot-button"
                  onClick={() => setSelectedSlot(s.time)}
                  className={`p-2 border rounded text-sm flex flex-col items-center ${
                    selectedSlot === s.time 
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" 
                      : s.isFull 
                        ? "bg-amber-50 border-amber-200 text-amber-800" 
                        : "bg-white hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium">{timeLabel}</span>
                  {s.isFull && <span className="text-[10px] opacity-80 mt-1">Popular</span>}
                </button>
              );
            })}
          </div>
        )}
        {selectedSlot && slots.find(s => s.time === selectedSlot)?.isFull && (
          <p className="mt-2 text-xs text-amber-600">Popular time, we&apos;ll confirm on WhatsApp.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Guests</label>
        <div className="flex items-center space-x-4">
          <button 
            type="button" 
            onClick={() => setPartySize(Math.max(1, partySize - 1))}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-xl hover:bg-gray-50"
          >-</button>
          <span className="text-lg font-medium w-6 text-center">{partySize}</span>
          <button 
            type="button" 
            onClick={() => setPartySize(Math.min(maxPartySize, partySize + 1))}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-xl hover:bg-gray-50"
          >+</button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input 
          type="text" 
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
        <input 
          type="tel" 
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="e.g. +91 99999 00000"
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Special Request (optional)</label>
        <textarea 
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full p-2 border rounded h-20"
        />
      </div>

      <div className="flex items-start gap-2 pt-2">
        <input 
          type="checkbox"
          id="marketingConsent"
          name="marketingConsent"
          className="mt-1"
          checked={marketingConsent}
          onChange={e => setMarketingConsent(e.target.checked)}
        />
        <label htmlFor="marketingConsent" className="text-sm">
          {marketingText}
        </label>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        By requesting, you agree to our <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
      </p>

      <button 
        type="submit" 
        disabled={!selectedSlot || submitting}
        className="w-full bg-[var(--color-primary)] text-white p-3 rounded font-medium disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Request Table"}
      </button>
    </form>
  );
}
