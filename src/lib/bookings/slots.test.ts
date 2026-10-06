import { expect, it, describe } from "vitest";
import { bookableSlots, occupiedSlots, isAligned } from "./slots";
import type { Hours } from "../settings/schema";

describe("slots", () => {
  const settings = {
    bookingCutoffMinutes: 60,
    bookingCapacityPerSlot: 30,
    maxPartySize: 12,
  };

  const defaultHours = (shifts: { open: string; close: string }[]): Hours => ({
    mon: shifts, tue: shifts, wed: shifts, thu: shifts, fri: shifts, sat: shifts, sun: shifts,
  });

  it("calculates basic slots", () => {
    // 12:00 to 23:00 -> first start 12:00, last start 21:30
    const now = new Date("2026-10-10T00:00:00.000+05:30").getTime();
    const slots = bookableSlots("2026-10-10", defaultHours([{ open: "12:00", close: "23:00" }]), now, settings, []);
    expect(slots[0]).toEqual(new Date("2026-10-10T12:00:00.000+05:30"));
    expect(slots[slots.length - 1]).toEqual(new Date("2026-10-10T21:30:00.000+05:30"));
  });

  it("handles overnight hours", () => {
    // 18:00 to 01:00 -> last start 23:30 (01:00 - 90 mins)
    const now = new Date("2026-10-10T00:00:00.000+05:30").getTime();
    const slots = bookableSlots("2026-10-10", defaultHours([{ open: "18:00", close: "01:00" }]), now, settings, []);
    expect(slots[0]).toEqual(new Date("2026-10-10T18:00:00.000+05:30"));
    expect(slots[slots.length - 1]).toEqual(new Date("2026-10-10T23:30:00.000+05:30"));

    // No slots from that shift on the *next* date 
    // If we request 2026-10-11, the 00:00-01:00 of the previous day's shift should NOT be included in 2026-10-11's slots.
    const nextDaySlots = bookableSlots("2026-10-11", defaultHours([{ open: "18:00", close: "01:00" }]), now, settings, []);
    expect(nextDaySlots[0]).toEqual(new Date("2026-10-11T18:00:00.000+05:30"));
  });

  it("handles two shifts per day", () => {
    const now = new Date("2026-10-10T00:00:00.000+05:30").getTime();
    const slots = bookableSlots("2026-10-10", defaultHours([{ open: "12:00", close: "15:00" }, { open: "19:00", close: "23:00" }]), now, settings, []);
    expect(slots).toContainEqual(new Date("2026-10-10T12:00:00.000+05:30"));
    expect(slots).toContainEqual(new Date("2026-10-10T13:30:00.000+05:30"));
    expect(slots).not.toContainEqual(new Date("2026-10-10T14:00:00.000+05:30"));
    expect(slots).toContainEqual(new Date("2026-10-10T19:00:00.000+05:30"));
    expect(slots).toContainEqual(new Date("2026-10-10T21:30:00.000+05:30"));
  });

  it("excludes blocked dates", () => {
    const now = new Date("2026-10-10T00:00:00.000+05:30").getTime();
    const slots = bookableSlots("2026-10-10", defaultHours([{ open: "12:00", close: "23:00" }]), now, settings, ["2026-10-10"]);
    expect(slots).toEqual([]);
  });

  it("respects cutoff", () => {
    // cutoff: with now = 18:30 and cutoff 60 the first slot is 19:30
    const now = new Date("2026-10-10T18:30:00.000+05:30").getTime();
    const slots = bookableSlots("2026-10-10", defaultHours([{ open: "18:00", close: "23:00" }]), now, settings, []);
    expect(slots[0]).toEqual(new Date("2026-10-10T19:30:00.000+05:30"));
  });

  it("excludes slots beyond 60 days", () => {
    // now is 2026-10-10
    const now = new Date("2026-10-10T00:00:00.000+05:30").getTime();
    // 60 days ahead is Dec 9, 2026. Dec 10 is 61 days ahead.
    const slots60 = bookableSlots("2026-12-09", defaultHours([{ open: "12:00", close: "23:00" }]), now, settings, []);
    expect(slots60.length).toBeGreaterThan(0);

    const slots61 = bookableSlots("2026-12-10", defaultHours([{ open: "12:00", close: "23:00" }]), now, settings, []);
    expect(slots61).toEqual([]);
  });

  it("occupiedSlots gives three slots", () => {
    const start = new Date("2026-10-10T19:00:00.000+05:30");
    const occupied = occupiedSlots(start);
    expect(occupied).toEqual([
      new Date("2026-10-10T19:00:00.000+05:30"),
      new Date("2026-10-10T19:30:00.000+05:30"),
      new Date("2026-10-10T20:00:00.000+05:30"),
    ]);
  });

  it("isAligned", () => {
    expect(isAligned(new Date("2026-10-10T19:00:00.000+05:30"))).toBe(true);
    expect(isAligned(new Date("2026-10-10T19:30:00.000+05:30"))).toBe(true);
    expect(isAligned(new Date("2026-10-10T19:15:00.000+05:30"))).toBe(false);
    expect(isAligned(new Date("2026-10-10T19:00:30.000+05:30"))).toBe(false);
    expect(isAligned(new Date("2026-10-10T19:00:00.001+05:30"))).toBe(false);
  });
});
