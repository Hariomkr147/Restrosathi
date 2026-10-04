import { TaxMode } from "@prisma/client";
import { rh } from "./money";

export class BillCalcError extends Error {
  constructor(public code: "EMPTY_BILL" | "INVALID_LINE" | "DISCOUNT_EXCEEDS_SUBTOTAL" | "INVALID_DISCOUNT") {
    super(code);
    this.name = "BillCalcError";
  }
}

export interface ComputeBillInput {
  lines: Array<{ unitPricePaise: number; qty: number }>;
  discount?: { type: "FLAT"; valuePaise: number } | { type: "PERCENT"; percent: number };
  taxMode: TaxMode;
  gstRatePercent: number;
  pricesIncludeTax: boolean;
}

export function computeBill(input: ComputeBillInput) {
  if (!input.lines || input.lines.length === 0) {
    throw new BillCalcError("EMPTY_BILL");
  }

  let subtotal = 0;
  for (const line of input.lines) {
    if (line.qty <= 0 || !Number.isInteger(line.unitPricePaise)) {
      throw new BillCalcError("INVALID_LINE");
    }
    subtotal += line.unitPricePaise * line.qty;
  }

  let discount = 0;
  if (input.discount) {
    if (input.discount.type === "FLAT") {
      discount = input.discount.valuePaise;
      if (discount <= 0 || discount > subtotal) {
        throw new BillCalcError("DISCOUNT_EXCEEDS_SUBTOTAL");
      }
    } else if (input.discount.type === "PERCENT") {
      if (input.discount.percent <= 0 || input.discount.percent > 100) {
        throw new BillCalcError("INVALID_DISCOUNT");
      }
      const bps = input.discount.percent * 100;
      discount = rh(subtotal * bps, 10000);
    }
  }

  const net = subtotal - discount;
  let taxable = net;
  let tax = 0;
  let cgst = 0;
  let sgst = 0;
  let beforeRound = net;

  const gstBps = input.gstRatePercent * 100;

  if (input.taxMode === "NONE" || input.taxMode === "COMPOSITION") {
    taxable = net;
    cgst = 0;
    sgst = 0;
    beforeRound = net;
  } else if (input.taxMode === "REGULAR") {
    if (input.pricesIncludeTax) {
      taxable = rh(net * 10000, 10000 + gstBps);
      tax = net - taxable;
      cgst = Math.floor(tax / 2);
      sgst = tax - cgst;
      beforeRound = net;
    } else {
      taxable = net;
      tax = rh(net * gstBps, 10000);
      cgst = Math.floor(tax / 2);
      sgst = tax - cgst;
      beforeRound = net + tax;
    }
  }

  const total = rh(beforeRound, 100) * 100;
  const roundOff = total - beforeRound;

  let docType: "BILL" | "BILL_OF_SUPPLY" | "TAX_INVOICE" = "BILL";
  if (input.taxMode === "COMPOSITION") docType = "BILL_OF_SUPPLY";
  if (input.taxMode === "REGULAR") docType = "TAX_INVOICE";

  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    taxableValuePaise: taxable,
    cgstPaise: cgst,
    sgstPaise: sgst,
    taxPaise: tax,
    roundOffPaise: roundOff,
    totalPaise: total,
    docType
  };
}
