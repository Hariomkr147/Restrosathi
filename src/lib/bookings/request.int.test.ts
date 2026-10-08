/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, it, describe, beforeEach } from "vitest";
import { requestBooking } from "./request";
import { prisma } from "../db";
import { asVerifiedPhone } from "../../../tests/helpers/otp";
import { getSettings } from "../settings";
import { bookableSlots } from "./slots";

describe("requestBooking", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.optOut.deleteMany();
    await prisma.consentRecord.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.rateHit.deleteMany();

    await prisma.customer.create({
      data: { phone: "+919999900000", name: "Test User", verifiedAt: new Date() }
    });
  });

  const getValidSlot = async () => {
    const settings = await getSettings();
    const now = Date.now();
    // 3 days from now
    const target = new Date(now + 3 * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000);
    const dateStr = target.toISOString().slice(0, 10);
    const slots = bookableSlots(dateStr, settings.hours, now, settings, []);
    return slots[0]!.toISOString();
  };

  it("unverified phone -> OTP_REQUIRED", async () => {
    const slot = await getValidSlot();
    const result = await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 2, slotStart: slot, note: "",
    }, {
      isPhoneVerified: async () => false,
      deviceId: "dev1"
    });
    expect(result).toEqual({ ok: false, error: "OTP_REQUIRED" });
  });

  it("verified -> creates REQUESTED + BOOKING_RECEIVED outbox row", async () => {
    const slot = await getValidSlot();
    const result = await requestBooking({
      name: "Test User", phone: "+919999900000", partySize: 4, slotStart: slot, note: "Allergy",
    }, {
      isPhoneVerified: async (p) => p === "+919999900000",
      deviceId: "dev1"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Failed");
    
    expect(result.cancelToken).toHaveLength(43);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: result.bookingId } });
    expect(booking.status).toBe("REQUESTED");
    expect(booking.name).toBe("Test User");
    expect(booking.cancelToken).toBe(result.cancelToken);

    const outbox = await prisma.messageLog.findFirstOrThrow();
    expect(outbox.kind).toBe("BOOKING_RECEIVED");
  });

  it("party size limits -> PARTY_TOO_LARGE", async () => {
    const slot = await getValidSlot();
    const result = await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 13, slotStart: slot, note: "",
    }, {
      isPhoneVerified: async () => true, deviceId: "dev1"
    });
    expect(result).toEqual({ ok: false, error: "PARTY_TOO_LARGE" });
  });

  it("unaligned/out-of-hours slot -> SLOT_UNAVAILABLE", async () => {
    const slot = new Date();
    slot.setHours(3, 15, 0, 0); // usually closed
    const result = await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 2, slotStart: slot.toISOString(), note: "",
    }, {
      isPhoneVerified: async () => true, deviceId: "dev1"
    });
    expect(result).toEqual({ ok: false, error: "SLOT_UNAVAILABLE" });
  });

  it("duplicate request on same phone same slot -> DUPLICATE_REQUEST", async () => {
    const slot = await getValidSlot();
    const ctx = { isPhoneVerified: async () => true, deviceId: "dev1" };
    
    await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 2, slotStart: slot, note: "",
    }, ctx);

    const result2 = await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 2, slotStart: slot, note: "",
    }, ctx);
    
    expect(result2).toEqual({ ok: false, error: "DUPLICATE_REQUEST" });

    // Different slot is fine
    const settings = await getSettings();
    const slots = bookableSlots(slot.slice(0, 10), settings.hours, Date.now(), settings, []);
    const diffSlot = slots[1]!.toISOString();
    
    const result3 = await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 2, slotStart: diffSlot, note: "",
    }, ctx);
    expect(result3.ok).toBe(true);
  });

  it("rate limits (5 per phone, 10 per device)", async () => {
    const slot = await getValidSlot();
    const ctx = { isPhoneVerified: async () => true, deviceId: "dev_rate_limit" };
    
    // Using diff slots to avoid duplicate error
    const settings = await getSettings();
    const slots = bookableSlots(slot.slice(0, 10), settings.hours, Date.now(), settings, []);

    // 5 allowed per phone
    for (let i = 0; i < 5; i++) {
      const res = await requestBooking({
        name: "Test", phone: "+919999900000", partySize: 2, slotStart: slots[i]!.toISOString(), note: "",
      }, ctx);
      expect(res.ok).toBe(true);
    }
    
    // 6th fails for phone
    const res6 = await requestBooking({
      name: "Test", phone: "+919999900000", partySize: 2, slotStart: slots[5]!.toISOString(), note: "",
    }, ctx);
    expect(res6).toEqual({ ok: false, error: "RATE_LIMITED" });

    // New phone, same device -> can do 4 more (device limit is 10, and res6 consumed 1)
    await prisma.customer.create({ data: { phone: "+919999900001", verifiedAt: new Date() } });
    for (let i = 6; i < 10; i++) {
      const res = await requestBooking({
        name: "Test", phone: "+919999900001", partySize: 2, slotStart: slots[i]!.toISOString(), note: "",
      }, ctx);
      expect(res.ok).toBe(true);
    }

    // 11th for device fails
    await prisma.customer.create({ data: { phone: "+919999900002", verifiedAt: new Date() } });
    const res11 = await requestBooking({
      name: "Test", phone: "+919999900002", partySize: 2, slotStart: slots[10]!.toISOString(), note: "",
    }, ctx);
    expect(res11).toEqual({ ok: false, error: "RATE_LIMITED" });
  });

});
