/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { sendDueReminders } from "./reminders";
import { notify } from "../whatsapp/notify";

const prisma = new PrismaClient();

describe("Reminders", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    await prisma.booking.deleteMany();
  });

  it("sends reminders exactly 3 hours before the slot for CONFIRMED bookings made early enough", async () => {
    const now = new Date("2026-10-10T15:00:00.000Z"); // 20:30 IST
    
    // Booking 1: 18:00Z (23:30 IST), made at 10:00Z (8 hours ahead). 3 hours ahead is 15:00Z. Should trigger.
    const b1 = await prisma.booking.create({
      data: {
        name: "B1", phone: "919999999991", partySize: 2,
        slotStart: new Date("2026-10-10T18:00:00.000Z"),
        status: "CONFIRMED",
        createdAt: new Date("2026-10-10T10:00:00.000Z"),
        cancelToken: "B1_TOKEN"
      }
    });

    // Booking 2: 18:00Z, but made at 16:00Z (only 2 hours ahead). Should NOT trigger.
    const b2 = await prisma.booking.create({
      data: {
        name: "B2", phone: "919999999992", partySize: 2,
        slotStart: new Date("2026-10-10T18:00:00.000Z"),
        status: "CONFIRMED",
        createdAt: new Date("2026-10-10T16:00:00.000Z"),
        cancelToken: "B2_TOKEN"
      }
    });

    // Booking 3: 19:00Z (4 hours ahead). Should NOT trigger.
    const b3 = await prisma.booking.create({
      data: {
        name: "B3", phone: "919999999993", partySize: 2,
        slotStart: new Date("2026-10-10T19:00:00.000Z"),
        status: "CONFIRMED",
        createdAt: new Date("2026-10-10T10:00:00.000Z"),
        cancelToken: "B3_TOKEN"
      }
    });

    const { count } = await sendDueReminders({ now });
    expect(count).toBe(1);

    const b1Updated = await prisma.booking.findUnique({ where: { id: b1.id } });
    expect(b1Updated?.reminderSentAt).not.toBeNull();

    const messages = await prisma.messageLog.findMany({ where: { kind: "BOOKING_REMINDER" } });
    expect(messages.length).toBe(1);
    expect(messages[0].phone).toBe("+919999999991");
  });
});
