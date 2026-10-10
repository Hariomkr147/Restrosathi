import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { cancelByToken } from "./cancel";
import { declineBooking } from "./confirm";

const prisma = new PrismaClient();

describe("cancelBooking", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany({ where: { name: "U1" } });
  });

  it("cancels a requested booking and sends a message if owner cancels", async () => {
    const user = await prisma.user.create({ data: { name: "U1", role: "OWNER" } });
    const b = await prisma.booking.create({
      data: {
        name: "Test", phone: "919999999999", partySize: 2,
        slotStart: new Date(Date.now() + 86400000),
        status: "REQUESTED", cancelToken: "TEST_TOKEN"
      }
    });

    const res = await declineBooking(b.id, undefined, user.id);
    expect(res.ok).toBe(true);

    const bUpdated = await prisma.booking.findUnique({ where: { id: b.id } });
    expect(bUpdated?.status).toBe("DECLINED");
    expect(bUpdated?.decidedById).toBe(user.id);
  });

  it("cancels with token if customer cancels", async () => {
    const b = await prisma.booking.create({
      data: {
        name: "Test", phone: "919999999999", partySize: 2,
        slotStart: new Date(Date.now() + 86400000),
        status: "CONFIRMED", cancelToken: "TEST_TOKEN"
      }
    });

    const res = await cancelByToken("TEST_TOKEN");
    expect(res.ok).toBe(true);

    const bUpdated = await prisma.booking.findUnique({ where: { id: b.id } });
    expect(bUpdated?.status).toBe("CANCELLED");
  });
});
