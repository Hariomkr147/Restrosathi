"use server";

import { requestBooking } from "@/lib/bookings/request";
import { isPhoneVerified } from "@/lib/otp/verified-cookie";
import { headers } from "next/headers";

export async function submitBooking(input: {
  name: string;
  phone: string;
  partySize: number;
  slotStart: string;
  note?: string;
}) {
  const reqHeaders = await headers();
  const deviceId = reqHeaders.get("x-forwarded-for") || reqHeaders.get("cf-connecting-ip") || "unknown-device";
  
  return await requestBooking(input, {
    isPhoneVerified,
    deviceId
  });
}

import { getSettings } from "@/lib/settings";
import { bookableSlots } from "@/lib/bookings/slots";
import { prisma } from "@/lib/db";

export async function getBookingSlots(dateStr: string) {
  const settings = await getSettings();
  const blockedDates = (await prisma.blockedDate.findMany()).map((b) => b.date);
  const slots = bookableSlots(dateStr, settings.hours, Date.now(), settings, blockedDates);

  // Check how many bookings overlap each slot to mark it "full"
  const startOfDay = new Date(`${dateStr}T00:00:00.000+05:30`);
  const nextDay = new Date(startOfDay);
  nextDay.setDate(nextDay.getDate() + 2); // get a wide enough range for overnight slots

  const activeBookings = await prisma.booking.findMany({
    where: {
      slotStart: { gte: startOfDay, lt: nextDay },
      status: { in: ["REQUESTED", "CONFIRMED", "ARRIVED"] }
    },
    select: { slotStart: true, partySize: true }
  });

  return slots.map(slot => {
    // A booking occupies 90 mins (start, start+30, start+60)
    // So for a given `slot` we need to see how many bookings are overlapping.
    // A booking overlaps this `slot` if its start is at `slot`, `slot - 30m`, or `slot - 60m`.
    const overlapping = activeBookings.filter(b => {
      const diffMins = (slot.getTime() - b.slotStart.getTime()) / (60 * 1000);
      return diffMins >= 0 && diffMins < 90;
    });
    const totalPax = overlapping.reduce((sum, b) => sum + b.partySize, 0);
    return {
      time: slot.toISOString(),
      isFull: totalPax >= settings.bookingCapacityPerSlot
    };
  });
}

import { requestOtp, verifyOtp } from "@/lib/otp";

export async function requestOtpAction(phone: string) {
  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for") || reqHeaders.get("cf-connecting-ip") || "unknown-ip";
  return await requestOtp(phone, { ip });
}

export async function verifyOtpAction(phone: string, code: string) {
  return await verifyOtp(phone, code, {});
}
