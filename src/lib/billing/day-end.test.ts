import { describe, it, expect } from "vitest";
import { dayWindowIst } from "./day-end";

describe("dayWindowIst", () => {
  it("calculates correct UTC window for IST date", () => {
    // 2026-10-02 in IST:
    // Start: 2026-10-02 00:00:00 IST -> 2026-10-01 18:30:00 UTC
    // End: 2026-10-03 00:00:00 IST -> 2026-10-02 18:30:00 UTC
    
    const window = dayWindowIst("2026-10-02");
    
    expect(window.from.toISOString()).toBe("2026-10-01T18:30:00.000Z");
    expect(window.to.toISOString()).toBe("2026-10-02T18:30:00.000Z");
  });
});
