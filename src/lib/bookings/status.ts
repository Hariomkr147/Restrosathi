import { BookingStatus, PrismaClient } from "@prisma/client";

export function canBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  
  if (from === BookingStatus.REQUESTED) {
    return to === BookingStatus.CONFIRMED || to === BookingStatus.DECLINED || to === BookingStatus.CANCELLED;
  }
  
  if (from === BookingStatus.CONFIRMED) {
    return to === BookingStatus.ARRIVED || to === BookingStatus.NO_SHOW || to === BookingStatus.CANCELLED;
  }
  
  return false;
}
export async function markBookingStatus(bookingId: string, status: BookingStatus, actorId: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "INVALID_STATUS" }> {
  const prisma = new PrismaClient();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "NOT_FOUND" };
  if (!canBookingTransition(booking.status, status)) {
    return { ok: false, error: "INVALID_STATUS" };
  }
  
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status, decidedById: actorId }
  });
  
  return { ok: true };
}
