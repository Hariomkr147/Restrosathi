import { describe, it, expect } from "vitest";
import { formatINR } from "./format";

describe("formatINR", () => {
  it("formats paise as rupees with Indian grouping", () => {
    expect(formatINR(12345650)).toBe("₹1,23,456.50");
  });
  it("formats zero", () => expect(formatINR(0)).toBe("₹0.00"));
  it("rejects non-integer paise", () => expect(() => formatINR(10.5)).toThrow());
});
