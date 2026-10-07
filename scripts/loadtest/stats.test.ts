import { describe, it, expect } from "vitest";
import { percentile } from "./stats";

describe("percentile", () => {
  it("calculates p50, p95, p99 on known arrays", () => {
    const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    // p50 of 10 items: index (10-1)*0.5 = 4.5 => (50+60)/2 = 55
    expect(percentile(data, 50)).toBe(55);
    
    // p95 of 10 items: index 9 * 0.95 = 8.55 => between 90 and 100
    // 90 + (100-90)*0.55 = 95.5
    expect(percentile(data, 95)).toBe(95.5);
    
    // p99 of 10 items: index 9 * 0.99 = 8.91 => between 90 and 100
    // 90 + 10 * 0.91 = 99.1
    expect(percentile(data, 99)).toBe(99.1);
  });

  it("handles empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("handles single value array", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 99)).toBe(42);
  });

  it("handles identical values", () => {
    const data = [10, 10, 10, 10];
    expect(percentile(data, 50)).toBe(10);
  });

  it("sorts array before calculating", () => {
    const data = [100, 10, 90, 20, 80, 30, 70, 40, 60, 50];
    expect(percentile(data, 50)).toBe(55);
  });
});
