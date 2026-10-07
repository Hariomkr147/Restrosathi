import { describe, expect, it } from "vitest";
import { calculateEarnedPoints, calculateRedemptionValue } from "./index";

describe("Loyalty pure helpers", () => {
  it("calculates earned points", () => {
    expect(calculateEarnedPoints(9999, 1)).toBe(0);
    expect(calculateEarnedPoints(10000, 1)).toBe(1);
    expect(calculateEarnedPoints(25000, 1)).toBe(2);
    expect(calculateEarnedPoints(25000, 2)).toBe(4);
  });

  it("calculates redemption discount", () => {
    // value of 100 points = 5000 paise
    expect(calculateRedemptionValue(100, 100, 5000)).toBe(5000);
    expect(calculateRedemptionValue(200, 100, 5000)).toBe(10000);
    expect(() => calculateRedemptionValue(150, 100, 5000)).toThrow("Points must be a multiple of the redemption unit");
  });
});
