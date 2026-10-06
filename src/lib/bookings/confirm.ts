import { Prisma, PrismaClient } from "@prisma/client";
import { notify } from "../whatsapp/notify";
import { canBookingTransition } from "./status";
import { audit } from "../audit";

const prisma = new PrismaClient();

export async function confirmBooking(bookingId: string, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_REQUESTED" | "CAPACITY_EXCEEDED" | "PAST" }> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return { ok: false, error: "NOT_FOUND" };
    
    if (booking.status !== "REQUESTED") {
      return { ok: false, error: "NOT_REQUESTED" };
    }
    
    const now = new Date();
    if (booking.slotStart < now) {
      return { ok: false, error: "PAST" };
    }
    
    // Acquire advisory lock per IST date
    const d = new Date(booking.slotStart.getTime());
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 330);
    const dateStr = d.toISOString().slice(0, 10);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking:' || ${dateStr}, 0))`;
    
    const settings = await tx.settings.findFirst();
    const capacity = settings?.bookingCapacityPerSlot || 30;
    
    // Compute used capacity for the 3 slots this booking would occupy
    const targetSlots = [
      booking.slotStart,
      new Date(booking.slotStart.getTime() + 30 * 60000),
      new Date(booking.slotStart.getTime() + 60 * 60000)
    ];
    
    // Find all confirmed or arrived bookings on that day
    const dayStart = new Date(dateStr + "T00:00:00Z");
    dayStart.setHours(dayStart.getHours() - 5, dayStart.getMinutes() - 30); // IST 00:00 is UTC 18:30 prev day
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    
    const existing = await tx.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "ARRIVED"] },
        slotStart: { gte: dayStart, lt: dayEnd }
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
        return { ok: false, error: "CAPACITY_EXCEEDED" };
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
    
    await notify("BOOKING_CONFIRMED", booking.phone, {
      name: booking.name,
      partySize: booking.partySize,
      time: booking.slotStart.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }),
      cancelToken: booking.cancelToken
    }, { tx, locale: booking.locale as any });
    
    await audit(tx, "booking.confirm", actorId, { bookingId });
    
    return { ok: true };
  });
}

export async function declineBooking(bookingId: string, reason: string | undefined, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_REQUESTED" }> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return { ok: false, error: "NOT_FOUND" };
    
    if (booking.status !== "REQUESTED") {
      return { ok: false, error: "NOT_REQUESTED" };
    }
    
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "DECLINED",
        declineReason: reason,
        decidedById: actorId
      }
    });
    
    await notify("BOOKING_DECLINED", booking.phone, {
      name: booking.name,
      reason: reason || "Fully booked"
    }, { tx, locale: booking.locale as any });
    
    await audit(tx, "booking.decline", actorId, { bookingId, reason });
    return { ok: true };
  });
}

export async function staffCancelBooking(bookingId: string, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "INVALID_STATUS" }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "NOT_FOUND" };
  if (!canBookingTransition(booking.status, "CANCELLED")) return { ok: false, error: "INVALID_STATUS" };
  
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", decidedById: actorId }
  });
  return { ok: true };
}
