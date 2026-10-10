import { PrismaClient } from "@prisma/client";
import { notify } from "../whatsapp/notify";
import { sendNow } from "../whatsapp/outbox";

const prisma = new PrismaClient();

export async function sendDueReminders({ now = new Date() }: { now?: Date } = {}) {
  // CONFIRMED bookings with reminderSentAt null,
  // slotStart > now, slotStart - now <= 3 h,
  // and createdAt <= slotStart - 3 h
  // No reminder when booking made less than 3 h ahead
  
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      slotStart: {
        gt: now,
        lte: threeHoursFromNow,
      },
    }
  });

  const results = await Promise.all(
    bookings.map(async (b) => {
      const createdAtPlus3 = new Date(b.createdAt.getTime() + 3 * 60 * 60 * 1000);
      if (createdAtPlus3 > b.slotStart) {
        return 0; // made less than 3h ahead
      }

      // Process
      const msgId = await prisma.$transaction(async (tx) => {
        // Atomic lock via update
        const updated = await tx.booking.updateMany({
          where: { id: b.id, reminderSentAt: null, status: "CONFIRMED" },
          data: { reminderSentAt: now }
        });
        
        if (updated.count === 0) return undefined;

        const timeFormatter = new Intl.DateTimeFormat(b.locale === "hi" ? "hi-IN" : "en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "numeric",
          hour12: true
        });
        const timeStr = timeFormatter.format(b.slotStart);

        const msg = await notify("BOOKING_REMINDER", b.phone, { time: timeStr }, { tx, locale: b.locale as "en" | "hi" });
        
        return msg && "id" in msg ? msg.id : undefined;
      });

      if (msgId) {
        sendNow(msgId).catch(() => {});
        return 1;
      }
      return 0;
    })
  );

  const count = results.reduce((sum: number, r) => sum + r, 0);
  return { count };
}
