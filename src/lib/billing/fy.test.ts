import { describe, expect, it } from "vitest";
import { financialYear, formatInvoiceNumber } from "./fy";

describe("fy", () => {
  it("2026-10-02 -> 2026-27", () => {
    expect(financialYear(new Date("2026-10-02T12:00:00Z"))).toBe("2026-27");
  });

  it("2027-03-31T18:29:59Z (still 31 March IST) -> 2026-27", () => {
    expect(financialYear(new Date("2027-03-31T18:29:59Z"))).toBe("2026-27");
  });

  it("2027-03-31T18:30:00Z (1 April 00:00 IST) -> 2027-28", () => {
    expect(financialYear(new Date("2027-03-31T18:30:00Z"))).toBe("2027-28");
  });

  it("formatInvoiceNumber(2026-27, 7) -> 2026-27/0007", () => {
    expect(formatInvoiceNumber("2026-27", 7)).toBe("2026-27/0007");
  });

  it("seq 12345 -> 2026-27/12345", () => {
    expect(formatInvoiceNumber("2026-27", 12345)).toBe("2026-27/12345");
  });
});
