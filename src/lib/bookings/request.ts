import { prisma } from "../db";
import { getSettings } from "../settings";
import { sendNow } from "../whatsapp/outbox";
import { notify } from "../whatsapp/notify";
import { bookableSlots } from "./slots";
import crypto from "crypto";

const deviceRateLimits = new Map<string, { date: string, count: number }>();

export type BookingRequestInput = {
  name: string;
  phone: string;
  partySize: number;
  slotStart: string;
  note?: string;
  marketingConsent?: boolean;
};

export type BookingRequestContext = {
  isPhoneVerified: (phone: string) => Promise<boolean>;
  deviceId: string;
};

export type BookingRequestResult = 
  | { ok: true; bookingId: string; cancelToken: string }
  | { ok: false; error: "OTP_REQUIRED" | "INVALID_INPUT" | "SLOT_UNAVAILABLE" | "PARTY_TOO_LARGE" | "DUPLICATE_REQUEST" | "RATE_LIMITED" };

export async function requestBooking(input: BookingRequestInput, ctx: BookingRequestContext): Promise<BookingRequestResult> {
  const { name, phone, partySize, slotStart, note } = input;
  
  if (!name || name.length > 60 || !phone.match(/^\+91\d{10}$/) || !slotStart || (note && note.length > 300)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const isVerified = await ctx.isPhoneVerified(phone);
  if (!isVerified) return { ok: false, error: "OTP_REQUIRED" };

  const settings = await getSettings();

  if (partySize < 1 || partySize > settings.maxPartySize) {
    return { ok: false, error: "PARTY_TOO_LARGE" };
  }

  const targetDate = new Date(slotStart);
  if (isNaN(targetDate.getTime())) return { ok: false, error: "INVALID_INPUT" };
  
  // Slot must be available. We need to check if it's in the bookable slots.
  // The local date string from IST time
  const istDateStr = new Date(targetDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  const blockedDates = (await prisma.blockedDate.findMany()).map((b) => b.date);
  const slots = bookableSlots(istDateStr, settings.hours, Date.now(), settings, blockedDates);
  
  if (!slots.some(s => s.getTime() === targetDate.getTime())) {
    // If it's not on the main date, maybe it's on the prev date overnight? 
    // Wait, bookableSlots calculates based on the dateStr provided.
    // If the slot is in an overnight shift starting yesterday, it might be in yesterday's slots.
    const prevDay = new Date(targetDate.getTime() + 5.5 * 60 * 60 * 1000);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDateStr = prevDay.toISOString().slice(0, 10);
    const prevSlots = bookableSlots(prevDateStr, settings.hours, Date.now(), settings, blockedDates);
    if (!prevSlots.some(s => s.getTime() === targetDate.getTime()) && !slots.some(s => s.getTime() === targetDate.getTime())) {
      return { ok: false, error: "SLOT_UNAVAILABLE" };
    }
  }

  // Rate limits: 5 per phone per day, 10 per device per day
  const todayStr = new Date().toISOString().slice(0, 10);
  const deviceState = deviceRateLimits.get(ctx.deviceId) || { date: todayStr, count: 0 };
  if (deviceState.date !== todayStr) { deviceState.date = todayStr; deviceState.count = 0; }
  if (deviceState.count >= 10) return { ok: false, error: "RATE_LIMITED" };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const phoneCount = await prisma.booking.count({
    where: { phone, createdAt: { gte: todayStart } }
  });
  if (phoneCount >= 5) return { ok: false, error: "RATE_LIMITED" };
  
  // Duplicate request on same phone + slotStart
  const duplicate = await prisma.booking.findFirst({
    where: {
      phone,
      slotStart: targetDate,
      status: { in: ["REQUESTED", "CONFIRMED"] }
    }
  });
  if (duplicate) return { ok: false, error: "DUPLICATE_REQUEST" };

  deviceState.count++;
  deviceRateLimits.set(ctx.deviceId, deviceState);

  const cancelToken = crypto.randomBytes(32).toString("base64url");

  const txResult = await prisma.$transaction(async (tx) => {
    const cust = await tx.customer.findUnique({ where: { phone } });
    if (!cust?.verifiedAt) throw new Error("PHONE_NOT_VERIFIED");

    const b = await tx.booking.create({
      data: {
        name, phone, partySize, slotStart: targetDate, note, cancelToken
      }
    });

    const msgRes = await notify(
      "BOOKING_RECEIVED", 
      phone, 
      { 
        date: targetDate.toISOString().slice(0, 10), 
        time: targetDate.toISOString().slice(11, 16), 
        pax: String(partySize)
      }, 
      { tx }
    );
    
    if (input.marketingConsent) {
      const { upsertCustomer } = await import("../customers");
      const { recordConsent } = await import("../customers/consent");
      const customer = await upsertCustomer(phone, { name }, tx);
      await recordConsent(customer.id, true, "BOOKING", undefined, tx);
    }

    return { bookingId: b.id, msgId: "id" in msgRes ? msgRes.id : undefined };
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "PHONE_NOT_VERIFIED") return { ok: false as const, error: "OTP_REQUIRED" as const };
    throw err;
  });

  if ("error" in txResult) return txResult;

  if (txResult.msgId) {
    sendNow(txResult.msgId).catch(console.error);
  }

  return { ok: true, bookingId: txResult.bookingId, cancelToken };
}
