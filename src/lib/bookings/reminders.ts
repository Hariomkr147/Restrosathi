/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { notify } from "../whatsapp/notify";
import { sendNow } from "../whatsapp/outbox";

const prisma = new PrismaClient();

export async function sendDueReminders({ now = new Date(), provider }: { now?: Date, provider?: any } = {}) {
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

  let count = 0;
  for (const b of bookings) {
    const createdAtPlus3 = new Date(b.createdAt.getTime() + 3 * 60 * 60 * 1000);
    if (createdAtPlus3 > b.slotStart) {
      continue; // made less than 3h ahead
    }

    // Process
    await prisma.$transaction(async (tx) => {
      // Re-check lock
      const locked = await tx.booking.findUnique({
        where: { id: b.id, reminderSentAt: null },
      });
      if (!locked) return;

      const timeFormatter = new Intl.DateTimeFormat(b.locale === "hi" ? "hi-IN" : "en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: true
      });
      const timeStr = timeFormatter.format(locked.slotStart);

      const msg = await notify("BOOKING_REMINDER", locked.phone, { time: timeStr }, { tx, locale: b.locale as "en" | "hi" });
      await tx.booking.update({
        where: { id: b.id },
        data: { reminderSentAt: now }
      });
      
      count++;
      if (msg && !("skipped" in msg)) {
        // Best effort
        sendNow(msg.id).catch(() => {});
      }
    });
  }

  return { count };
}
