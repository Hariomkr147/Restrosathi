import { expect, it } from "vitest";
import { generateTableCode } from "./code";
import { tableUrl, qrSvg } from "../qr";

it("generates 2000 distinct ten-character codes without look-alikes", () => {
  const codes = Array.from({ length: 2000 }, generateTableCode);
  for (const code of codes) expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
  expect(new Set(codes).size).toBe(2000);
});
it("builds the table URL and an SVG QR", async () => {
  expect(tableUrl("ABC")).toMatch(/\/t\/ABC$/);
  expect(await qrSvg(tableUrl("ABC"))).toContain("<svg");
});
