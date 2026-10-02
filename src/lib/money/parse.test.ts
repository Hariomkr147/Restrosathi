import { expect, it } from "vitest";
import { parseINR } from "./parse";

it("parses decimal prices into exact integer paise", () => {
  expect(parseINR(" 180.00 ")).toBe(18000);
  expect(parseINR("0.29")).toBe(29);
  expect(parseINR("1.2")).toBe(120);
  expect(parseINR("0")).toBe(0);
});
it("rejects malformed, fractional-paise and unsafe prices", () => {
  for (const value of ["", "-1", "1.001", "1e3", "Infinity", "99999999999999999999"]) expect(parseINR(value)).toBeNull();
});
