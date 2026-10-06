import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { confirmBooking } from "./confirm";

const prisma = new PrismaClient();

describe("confirmBooking", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany();
  });

  it("confirms a requested booking and sends a message", async () => {
    const user = await prisma.user.create({ data: { name: "U1", role: "OWNER" } });
    const b = await prisma.booking.create({
      data: {
        name: "Test", phone: "919999999999", partySize: 2,
        slotStart: new Date("2026-10-10T14:30:00.000Z"), // 20:00 IST
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
});
