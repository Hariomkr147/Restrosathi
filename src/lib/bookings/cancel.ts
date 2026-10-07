/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { canBookingTransition } from "./status";
import { notify } from "../whatsapp/notify";

const prisma = new PrismaClient();

export async function cancelByToken(cancelToken: string): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "INVALID_STATUS" }> {
  const booking = await prisma.booking.findUnique({ where: { cancelToken } });
  if (!booking) return { ok: false, error: "NOT_FOUND" };
  
  if (!canBookingTransition(booking.status, "CANCELLED")) {
    return { ok: false, error: "INVALID_STATUS" };
  }
  
  await prisma.booking.update({
    where: { cancelToken },
    data: {
      status: "CANCELLED"
    }
  });
  
  await notify("BOOKING_CANCELLED", booking.phone, {
    name: booking.name,
    time: booking.slotStart.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
  }, { locale: booking.locale as any });
  
  return { ok: true };
}
