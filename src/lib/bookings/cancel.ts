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
  
  const msgId = await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { cancelToken },
      data: {
        status: "CANCELLED"
      }
    });
    
    const msgRes = await notify("BOOKING_CANCELLED", booking.phone, {}, { tx, locale: booking.locale as "en" | "hi" });
    return "id" in msgRes ? msgRes.id : undefined;
  });

  if (msgId) {
    import("../whatsapp/outbox").then(({ sendNow }) => sendNow(msgId)).catch(() => {});
  }
  
  return { ok: true };
}
