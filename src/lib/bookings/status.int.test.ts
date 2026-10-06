import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { markBookingStatus } from "./status";

const prisma = new PrismaClient();

describe("markBookingStatus", () => {
  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany();
  });

  it("updates booking status", async () => {
    const user = await prisma.user.create({ data: { name: "U1", role: "OWNER" } });
    const b = await prisma.booking.create({
      data: {
        name: "Test", phone: "919999999999", partySize: 2,
        slotStart: new Date("2026-10-10T14:30:00.000Z"),
        status: "CONFIRMED", cancelToken: "TEST_TOKEN"
      }
    });

    const res = await markBookingStatus(b.id, "ARRIVED", user.id);
    expect(res.ok).toBe(true);

    const bUpdated = await prisma.booking.findUnique({ where: { id: b.id } });
    expect(bUpdated?.status).toBe("ARRIVED");
  });
});
