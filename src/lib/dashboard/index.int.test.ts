import { describe, it, expect } from "vitest";
import { getDashboardFacts } from "./index";

describe("Dashboard Facts Integration", () => {
  it("computes facts safely and returns expected shape without fractional paise or crashing", async () => {
    const facts = await getDashboardFacts();
    
    // Type and constraints checks
    expect(Number.isInteger(facts.todayTotal)).toBe(true);
    expect(Number.isInteger(facts.todayAverage)).toBe(true);
    
    // Arrays exist and have correct length
    expect(facts.busyHours.length).toBe(24);
    expect(facts.dailySales.length).toBe(30);
    
    // Values that should be arrays
    expect(Array.isArray(facts.topDishesToday)).toBe(true);
    expect(Array.isArray(facts.topDishes7Day)).toBe(true);
    
    // Bookings and thread counts should be integers
    expect(Number.isInteger(facts.bookingsToday)).toBe(true);
    expect(Number.isInteger(facts.bookingsTomorrow)).toBe(true);
    expect(Number.isInteger(facts.bookingsNextFive)).toBe(true);
    expect(Number.isInteger(facts.needsHumanCount)).toBe(true);
    expect(Number.isInteger(facts.openSessions)).toBe(true);
  });
});
