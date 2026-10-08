/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, PrismaClient } from "@prisma/client";
import { notify } from "../whatsapp/notify";
import { canBookingTransition } from "./status";
import { audit } from "../audit";

const prisma = new PrismaClient();

export async function confirmBooking(bookingId: string, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_REQUESTED" | "CAPACITY_EXCEEDED" | "PAST" }> {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return { ok: false as const, error: "NOT_FOUND" as const };
    
    if (booking.status !== "REQUESTED") {
      return { ok: false as const, error: "NOT_REQUESTED" as const };
    }
    
    const now = new Date();
    if (booking.slotStart < now) {
      return { ok: false as const, error: "PAST" as const };
    }
    
    // Acquire advisory lock per IST date, extending for overnight overlap (lock prior date and target date in sorted order)
    const istTime = new Date(booking.slotStart.getTime() + 5.5 * 60 * 60 * 1000);
    const dateStr = istTime.toISOString().slice(0, 10);
    const priorIstTime = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    const priorDateStr = priorIstTime.toISOString().slice(0, 10);
    
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking:' || ${priorDateStr}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking:' || ${dateStr}, 0))`;

    // Re-read REQUESTED after lock
    const bookingRefreshed = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!bookingRefreshed || bookingRefreshed.status !== "REQUESTED") {
       return { ok: false as const, error: "NOT_REQUESTED" as const };
    }
    
    const settings = await tx.settings.findFirst();
    const capacity = settings?.bookingCapacityPerSlot || 30;
    
    // Compute used capacity for the 3 slots this booking would occupy
    const targetSlots = [
      booking.slotStart,
      new Date(booking.slotStart.getTime() + 30 * 60000),
      new Date(booking.slotStart.getTime() + 60 * 60000)
    ];
    
    // Query every booking overlapping its occupied slots (start +/- 90 mins is sufficient)
    const windowStart = new Date(booking.slotStart.getTime() - 90 * 60000);
    const windowEnd = new Date(booking.slotStart.getTime() + 90 * 60000);
    
    const existing = await tx.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "ARRIVED"] },
        slotStart: { gte: windowStart, lt: windowEnd }
      }
    });
    
    for (const targetSlot of targetSlots) {
      let used = 0;
      for (const ex of existing) {
        const exStart = ex.slotStart.getTime();
        // Booking occupies start, start+30, start+60
        if (targetSlot.getTime() >= exStart && targetSlot.getTime() <= exStart + 60 * 60000) {
          used += ex.partySize;
        }
      }
      if (used + booking.partySize > capacity) {
        return { ok: false as const, error: "CAPACITY_EXCEEDED" as const };
      }
    }
    
    // Confirm it
    const confirmed = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        decidedById: actorId
      }
    });
    
    const msgRes = await notify("BOOKING_CONFIRMED", booking.phone, {
      date: booking.slotStart.toISOString().slice(0, 10),
      pax: booking.partySize,
      time: booking.slotStart.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }),
    }, { tx, locale: booking.locale as "en" | "hi" });
    
    await audit({ action: "booking.confirm", actorId, entity: "booking", entityId: bookingId }, tx);
    
    return { ok: true as const, msgId: "id" in msgRes ? msgRes.id : undefined };
  });

  if (result.ok && result.msgId) {
    const mId = result.msgId;
    import("../whatsapp/outbox").then(({ sendNow }) => sendNow(mId)).catch(() => {});
  }
  return "msgId" in result ? { ok: true } : result;
}

export async function declineBooking(bookingId: string, reason: string | undefined, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_REQUESTED" }> {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return { ok: false as const, error: "NOT_FOUND" as const };
    
    if (booking.status !== "REQUESTED") {
      return { ok: false as const, error: "NOT_REQUESTED" as const };
    }
    
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "DECLINED",
        declineReason: reason,
        decidedById: actorId
      }
    });
    
    const msgRes = await notify("BOOKING_DECLINED", booking.phone, {}, { tx, locale: booking.locale as "en" | "hi" });
    
    await audit({ action: "booking.decline", actorId, entity: "booking", entityId: bookingId, data: reason ? { reason } : {} }, tx);
    return { ok: true as const, msgId: "id" in msgRes ? msgRes.id : undefined };
  });

  if (result.ok && result.msgId) {
    const mId = result.msgId;
    import("../whatsapp/outbox").then(({ sendNow }) => sendNow(mId)).catch(() => {});
  }
  return "msgId" in result ? { ok: true } : result;
}

export async function staffCancelBooking(bookingId: string, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "INVALID_STATUS" }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false as const, error: "NOT_FOUND" as const };
  if (!canBookingTransition(booking.status, "CANCELLED")) return { ok: false as const, error: "INVALID_STATUS" as const };
  
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", decidedById: actorId }
  });
  return { ok: true };
}
