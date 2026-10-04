import { describe, expect, it } from "vitest";
import { computeBill, BillCalcError } from "./calc";
import { TaxMode } from "@prisma/client";

describe("calc", () => {
  it("NONE, one line 12345 x 1 -> subtotal 12345, tax 0, total 12300, roundOff -45, docType BILL", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 12345, qty: 1 }],
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res).toEqual({
      subtotalPaise: 12345,
      discountPaise: 0,
      taxableValuePaise: 12345,
      cgstPaise: 0,
      sgstPaise: 0,
      taxPaise: 0,
      roundOffPaise: -45,
      totalPaise: 12300,
      docType: "BILL"
    });
  });

  it("COMPOSITION, same input -> same numbers, docType BILL_OF_SUPPLY", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 12345, qty: 1 }],
      taxMode: "COMPOSITION",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res).toEqual({
      subtotalPaise: 12345,
      discountPaise: 0,
      taxableValuePaise: 12345,
      cgstPaise: 0,
      sgstPaise: 0,
      taxPaise: 0,
      roundOffPaise: -45,
      totalPaise: 12300,
      docType: "BILL_OF_SUPPLY"
    });
  });

  it("REGULAR incl, subtotal 10500 -> taxable 10000, tax 500, cgst 250, sgst 250, roundOff 0, total 10500, docType TAX_INVOICE", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 10500, qty: 1 }],
      taxMode: "REGULAR",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res).toEqual({
      subtotalPaise: 10500,
      discountPaise: 0,
      taxableValuePaise: 10000,
      cgstPaise: 250,
      sgstPaise: 250,
      taxPaise: 500,
      roundOffPaise: 0,
      totalPaise: 10500,
      docType: "TAX_INVOICE"
    });
  });

  it("REGULAR excl, subtotal 10000 -> taxable 10000, tax 500, cgst 250, sgst 250, total 10500", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 10000, qty: 1 }],
      taxMode: "REGULAR",
      gstRatePercent: 5,
      pricesIncludeTax: false
    });
    expect(res).toEqual({
      subtotalPaise: 10000,
      discountPaise: 0,
      taxableValuePaise: 10000,
      cgstPaise: 250,
      sgstPaise: 250,
      taxPaise: 500,
      roundOffPaise: 0,
      totalPaise: 10500,
      docType: "TAX_INVOICE"
    });
  });

  it("REGULAR excl, subtotal 3300 -> tax 165, cgst 82, sgst 83, beforeRound 3465, total 3500, roundOff +35", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 3300, qty: 1 }],
      taxMode: "REGULAR",
      gstRatePercent: 5,
      pricesIncludeTax: false
    });
    expect(res).toEqual({
      subtotalPaise: 3300,
      discountPaise: 0,
      taxableValuePaise: 3300,
      cgstPaise: 82,
      sgstPaise: 83,
      taxPaise: 165,
      roundOffPaise: 35,
      totalPaise: 3500,
      docType: "TAX_INVOICE"
    });
  });

  it("REGULAR incl, subtotal 9999 -> taxable 9523, tax 476, cgst 238, sgst 238, total 10000, roundOff +1", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 9999, qty: 1 }],
      taxMode: "REGULAR",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res).toEqual({
      subtotalPaise: 9999,
      discountPaise: 0,
      taxableValuePaise: 9523,
      cgstPaise: 238,
      sgstPaise: 238,
      taxPaise: 476,
      roundOffPaise: 1,
      totalPaise: 10000,
      docType: "TAX_INVOICE"
    });
  });

  it("NONE, subtotal 12350 -> total 12400, roundOff +50 (exact half rounds up)", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 12350, qty: 1 }],
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res.roundOffPaise).toBe(50);
    expect(res.totalPaise).toBe(12400);
  });

  it("NONE, 20000 with PERCENT 10 -> discount 2000, total 18000", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 20000, qty: 1 }],
      discount: { type: "PERCENT", percent: 10 },
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res.discountPaise).toBe(2000);
    expect(res.totalPaise).toBe(18000);
  });

  it("NONE, 3333 with PERCENT 15 -> discount 500 (499.95 rounds up), net 2833, total 2800, roundOff -33", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 3333, qty: 1 }],
      discount: { type: "PERCENT", percent: 15 },
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res.discountPaise).toBe(500);
    expect(res.subtotalPaise - res.discountPaise).toBe(2833);
    expect(res.roundOffPaise).toBe(-33);
    expect(res.totalPaise).toBe(2800);
  });

  it("REGULAR incl, 20000 with PERCENT 10 -> net 18000, taxable 17143, tax 857, cgst 428, sgst 429, total 18000", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 20000, qty: 1 }],
      discount: { type: "PERCENT", percent: 10 },
      taxMode: "REGULAR",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res).toEqual({
      subtotalPaise: 20000,
      discountPaise: 2000,
      taxableValuePaise: 17143,
      cgstPaise: 428,
      sgstPaise: 429,
      taxPaise: 857,
      roundOffPaise: 0,
      totalPaise: 18000,
      docType: "TAX_INVOICE"
    });
  });

  it("FLAT 2500 on 20000 -> total 17500; FLAT 25000 on 20000 -> throws DISCOUNT_EXCEEDS_SUBTOTAL", () => {
    const res = computeBill({
      lines: [{ unitPricePaise: 20000, qty: 1 }],
      discount: { type: "FLAT", valuePaise: 2500 },
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    });
    expect(res.totalPaise).toBe(17500);

    expect(() => computeBill({
      lines: [{ unitPricePaise: 20000, qty: 1 }],
      discount: { type: "FLAT", valuePaise: 25000 },
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    })).toThrowError(new BillCalcError("DISCOUNT_EXCEEDS_SUBTOTAL"));
  });

  it("PERCENT 0 and PERCENT 101 -> INVALID_DISCOUNT; empty lines -> EMPTY_BILL; qty 0 or non-integer price -> INVALID_LINE", () => {
    const baseOpts = { taxMode: "NONE" as TaxMode, gstRatePercent: 5, pricesIncludeTax: true };
    expect(() => computeBill({ lines: [{ unitPricePaise: 10000, qty: 1 }], discount: { type: "PERCENT", percent: 0 }, ...baseOpts })).toThrowError(new BillCalcError("INVALID_DISCOUNT"));
    expect(() => computeBill({ lines: [{ unitPricePaise: 10000, qty: 1 }], discount: { type: "PERCENT", percent: 101 }, ...baseOpts })).toThrowError(new BillCalcError("INVALID_DISCOUNT"));
    expect(() => computeBill({ lines: [], ...baseOpts })).toThrowError(new BillCalcError("EMPTY_BILL"));
    expect(() => computeBill({ lines: [{ unitPricePaise: 10000, qty: 0 }], ...baseOpts })).toThrowError(new BillCalcError("INVALID_LINE"));
    expect(() => computeBill({ lines: [{ unitPricePaise: 100.5, qty: 1 }], ...baseOpts })).toThrowError(new BillCalcError("INVALID_LINE"));
  });

  it("Property test (seeded pseudo-random, 500 cases, all modes)", () => {
    // Simple LCG
    let seed = 12345;
    function nextInt(max: number) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    }

    const modes: TaxMode[] = ["NONE", "COMPOSITION", "REGULAR"];
    for (let i = 0; i < 500; i++) {
      const lineCount = 1 + nextInt(10);
      const lines = Array.from({ length: lineCount }).map(() => ({
        unitPricePaise: 100 + nextInt(50000),
        qty: 1 + nextInt(5)
      }));
      const taxMode = modes[nextInt(3)];
      const gstRatePercent = 5 + nextInt(4) * 5; // e.g. 5, 10, 15, 20
      const pricesIncludeTax = nextInt(2) === 0;

      const hasDiscount = nextInt(3) === 0;
      let discount: { type: "FLAT" | "PERCENT"; valuePaise?: number; percent?: number } | undefined;
      const subtotal = lines.reduce((acc, l) => acc + l.unitPricePaise * l.qty, 0);

      if (hasDiscount) {
        if (nextInt(2) === 0) {
          discount = { type: "FLAT", valuePaise: 1 + nextInt(Math.max(1, subtotal - 1)) };
        } else {
          discount = { type: "PERCENT", percent: 1 + nextInt(100) };
        }
      }

      const res = computeBill({ lines, taxMode, gstRatePercent, pricesIncludeTax, discount: discount as any });

      expect(res.cgstPaise + res.sgstPaise).toBe(res.taxPaise);
      expect(res.totalPaise % 100).toBe(0);
      expect(res.roundOffPaise).toBeGreaterThanOrEqual(-49);
      expect(res.roundOffPaise).toBeLessThanOrEqual(50);
      expect(res.totalPaise).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(res.subtotalPaise)).toBe(true);
      expect(Number.isInteger(res.discountPaise)).toBe(true);
      expect(Number.isInteger(res.taxableValuePaise)).toBe(true);
      expect(Number.isInteger(res.cgstPaise)).toBe(true);
      expect(Number.isInteger(res.sgstPaise)).toBe(true);
      expect(Number.isInteger(res.taxPaise)).toBe(true);
      expect(Number.isInteger(res.roundOffPaise)).toBe(true);
      expect(Number.isInteger(res.totalPaise)).toBe(true);

      const net = res.subtotalPaise - res.discountPaise;
      if (taxMode === "REGULAR") {
        if (pricesIncludeTax) {
          expect(res.taxableValuePaise + res.taxPaise).toBe(net);
        }
      } else {
        expect(res.taxPaise).toBe(0);
      }
    }
  });
});
