import { expect, test } from "vitest";
import { normalizePhone } from "./phone";

test("normalizePhone", () => {
  expect(normalizePhone("98765 43210")).toBe("+919876543210");
  expect(normalizePhone("09876543210")).toBe("+919876543210");
  expect(normalizePhone("919876543210")).toBe("+919876543210");
  expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
  expect(normalizePhone("(+91) 98765 43210")).toBe("+919876543210");
  
  // Rejects
  expect(normalizePhone("12345")).toBeNull();
  expect(normalizePhone("5876543210")).toBeNull(); // starts with 5
  expect(normalizePhone("+14155550123")).toBeNull();
  expect(normalizePhone("98765432101")).toBeNull();
  expect(normalizePhone("")).toBeNull();
  expect(normalizePhone("abcdefghij")).toBeNull();
  expect(normalizePhone("98765a3210")).toBeNull();
});
