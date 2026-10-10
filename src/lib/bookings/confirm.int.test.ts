import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { confirmBooking } from "./confirm";

const prisma = new PrismaClient();

describe("confirmBooking", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany({ where: { name: "U1" } });
  });

  it("confirms a requested booking and sends a message", async () => {
    const user = await prisma.user.create({ data: { name: "U1", role: "OWNER" } });
    const b = await prisma.booking.create({
      data: {
        name: "Test", phone: "919999999999", partySize: 2,
        slotStart: new Date(Date.now() + 24 * 3600 * 1000), // future
        status: "REQUESTED", cancelToken: "TEST_TOKEN"
      }
    });

    const res = await confirmBooking(b.id, user.id);
    expect(res.ok).toBe(true);

    const bUpdated = await prisma.booking.findUnique({ where: { id: b.id } });
    expect(bUpdated?.status).toBe("CONFIRMED");
    expect(bUpdated?.decidedById).toBe(user.id);
    expect(bUpdated?.confirmedAt).not.toBeNull();
  });

  it("handles capacity-10 concurrent parties-of-three exactly three successes in three loops", async () => {
    const user = await prisma.user.create({ data: { name: "U1", role: "OWNER" } });
    const settings = await prisma.settings.findFirst();
    if (settings) {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { bookingCapacityPerSlot: 10 }
      });
    } else {
      await prisma.settings.create({
        data: {
          name: "Test",
          about: {},
          address: "Test",
          phone: "9999999999",
          whatsappPhone: "9999999999",
          bookingCutoffMinutes: 60,
          bookingCapacityPerSlot: 10,
          maxPartySize: 12,
          hours: {}
        }
      });
    }

    const targetDate = new Date(Date.now() + 24 * 3600 * 1000); // tomorrow

    // create 10 REQUESTED bookings of size 3 for the same time
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        prisma.booking.create({
          data: {
            name: `Test${i}`, phone: "919999999999", partySize: 3,
            slotStart: targetDate,
            status: "REQUESTED", cancelToken: `TEST_TOKEN_${i}`
          }
        })
      );
    }
    const bookings = await Promise.all(promises);

    // run 3 loops of concurrent confirmations
    let totalSuccess = 0;
    let totalExceeded = 0;

    for (let loop = 0; loop < 3; loop++) {
      const confirmPromises = bookings.map(b => confirmBooking(b.id, user.id));
      const results = await Promise.all(confirmPromises);
      const loopSuccess = results.filter(r => r.ok).length;
      const loopExceeded = results.filter(r => !r.ok && "error" in r && r.error === "CAPACITY_EXCEEDED").length;
      totalSuccess += loopSuccess;
      totalExceeded += loopExceeded;
    }

    // Capacity is 10, each is 3. Max allowed is 3 (3 * 3 = 9).
    // Exactly 3 successes overall!
    expect(totalSuccess).toBe(3);
    // The others might be CAPACITY_EXCEEDED or NOT_REQUESTED because they were already processed.
    // Let's just check DB
    const confirmedCount = await prisma.booking.count({ where: { status: "CONFIRMED" } });
    expect(confirmedCount).toBe(3);
  });
});
