import { prisma } from "../db";

export type BillPrint = {
  header: {
    name: string;
    address: string;
    phone: string;
    gstin?: string;
    fssai?: string;
  };
  title: "Bill" | "Bill of Supply" | "Tax Invoice";
  status: "OPEN" | "SETTLED" | "CANCELLED";
  number?: string;
  dateTime: string;
  where: string;
  lines: Array<{
    name: any;
    variant?: any;
    modifiers: any;
    qty: number;
    unitPricePaise: number;
    linePaise: number;
  }>;
  subtotal: number;
  discount?: { value: number; type: "FLAT" | "PERCENT"; reason: string };
  taxLines: Array<{ label: string; paise: number }>;
  taxableValue?: number;
  roundOff: number;
  total: number;
  payments: Array<{ method: string; amountPaise: number }>;
  cancelledAt?: string;
};

export async function getBillPrint(billId: string, actor: { id: string, role: string }): Promise<BillPrint | null> {
  if (actor.role !== "OWNER" && actor.role !== "STAFF") return null;

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      payments: true,
      lines: true,
      session: { include: { table: true } }
    }
  });

  if (!bill) return null;

  const header = bill.header as BillPrint["header"];
  
  let title: BillPrint["title"] = "Bill";
  if (bill.taxMode === "COMPOSITION") title = "Bill of Supply";
  if (bill.taxMode === "REGULAR") title = "Tax Invoice";

  const taxLines = [];
  if (bill.taxMode === "REGULAR") {
    if (bill.cgstPaise > 0) taxLines.push({ label: `CGST ${bill.gstRatePercent / 2}%`, paise: bill.cgstPaise });
    if (bill.sgstPaise > 0) taxLines.push({ label: `SGST ${bill.gstRatePercent / 2}%`, paise: bill.sgstPaise });
  } else {
    // If not REGULAR, GSTIN should not be shown per requirements
    header.gstin = undefined;
  }

  const where = bill.session.kind === "TAKEAWAY" ? "Takeaway" : `Table ${bill.session.table?.label || ""}`;
  
  return {
    header,
    title,
    status: bill.status,
    number: bill.number || undefined,
    dateTime: bill.generatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    where,
    lines: bill.lines.map(l => ({
      name: l.name,
      variant: l.variant,
      modifiers: l.modifiers,
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      linePaise: l.linePaise
    })),
    subtotal: bill.subtotalPaise,
    discount: bill.discountPaise > 0 ? { value: bill.discountValue || 0, type: bill.discountType as any, reason: bill.discountReason || "" } : undefined,
    taxLines,
    taxableValue: bill.taxMode === "REGULAR" ? bill.taxableValuePaise : undefined,
    roundOff: bill.roundOffPaise,
    total: bill.totalPaise,
    payments: bill.payments.map(p => ({ method: p.method, amountPaise: p.amountPaise })),
    cancelledAt: bill.cancelledAt ? bill.cancelledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : undefined
  };
}
