import { expect, it } from "vitest";
import { getSettings } from "./index";
import { hoursSchema } from "./schema";

it("returns the seeded restaurant", async () => {
  const s = await getSettings();
  expect(s.name).toBe("Saffron Tadka");
  expect(s.about.en.length).toBeGreaterThan(0);
  expect(s.hours.mon[0]).toEqual({ open: "11:00", close: "23:00" });
});

it("rejects malformed hours", () => {
  expect(hoursSchema.safeParse({ mon: [{ open: "25:00", close: "23:00" }] }).success).toBe(false);
});

it("accepts overnight hours", () => {
  const all = Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, [{ open: "18:00", close: "01:00" }]]),
  );
  expect(hoursSchema.safeParse(all).success).toBe(true);
});
