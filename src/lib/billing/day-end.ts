import { Prisma } from "@prisma/client";
import { prisma } from "../db";

export function dayWindowIst(dateStr: string): { from: Date; to: Date } {
  // Parse dateStr which is YYYY-MM-DD
  const [year, month, day] = dateStr.split("-").map(Number);
  
  // Create a Date representing 00:00:00 in Asia/Kolkata
  // The offset for IST is UTC+5:30.
  // We can construct UTC dates by subtracting 5 hours and 30 minutes from the local time.
  const from = new Date(Date.UTC(year, month - 1, day, -5, -30, 0, 0));
  const to = new Date(Date.UTC(year, month - 1, day + 1, -5, -30, 0, 0));
  
  return { from, to };
}

export type DayEndReport = {
  date: string;
  billCount: number;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  byMethod: {
    CASH: number;
    UPI: number;
    CARD: number;
  };
  cancelled: {
    count: number;
    totalPaise: number;
  };
  voidedLines: {
    count: number;
    valuePaise: number;
  };
  reconciles: boolean;
};

export async function getDayEnd(dateStr: string, actor: { id: string, role: string }): Promise<DayEndReport> {
  if (actor.role !== "OWNER") {
    throw new Error("FORBIDDEN"); // Should ideally throw AuthError, but relying on requireUser in routing typically.
  }

  const { from, to } = dayWindowIst(dateStr);

  // Get settled bills
  const settledBills = await prisma.bill.findMany({
    where: {
      status: "SETTLED",
      settledAt: { gte: from, lt: to }
    },
    include: { payments: true }
  });

  // Get cancelled bills
  const cancelledBills = await prisma.bill.findMany({
    where: {
      status: "CANCELLED",
      cancelledAt: { gte: from, lt: to }
    }
  });

  // Get voided lines
  const voidedLines = await prisma.orderLine.findMany({
    where: {
      voidedAt: { gte: from, lt: to }
    }
  });

  let billCount = 0;
  let subtotalPaise = 0;
  let discountPaise = 0;
  let taxPaise = 0;
  let roundOffPaise = 0;
  let totalPaise = 0;
  const byMethod = { CASH: 0, UPI: 0, CARD: 0 };

  let isArithmeticCorrect = true;

  for (const bill of settledBills) {
    billCount++;
    subtotalPaise += bill.subtotalPaise;
    discountPaise += bill.discountPaise;
    const tax = bill.cgstPaise + bill.sgstPaise;
    taxPaise += tax;
    roundOffPaise += bill.roundOffPaise;
    totalPaise += bill.totalPaise;

    for (const payment of bill.payments) {
      const method = payment.method as keyof typeof byMethod;
      if (method in byMethod) {
        byMethod[method] += payment.amountPaise;
      }
    }

    // Arithmetic Check
    if (bill.pricesIncludeTax) {
      if (bill.subtotalPaise - bill.discountPaise + bill.roundOffPaise !== bill.totalPaise) {
        isArithmeticCorrect = false;
      }
    } else {
      if (bill.subtotalPaise - bill.discountPaise + tax + bill.roundOffPaise !== bill.totalPaise) {
        isArithmeticCorrect = false;
      }
    }
  }

  const cancelledCount = cancelledBills.length;
  const cancelledTotalPaise = cancelledBills.reduce((acc, b) => acc + b.totalPaise, 0);

  const voidedCount = voidedLines.length;
  const voidedValuePaise = voidedLines.reduce((acc, l) => acc + (l.qty * l.unitPricePaise), 0);

  const sumMethods = byMethod.CASH + byMethod.UPI + byMethod.CARD;
  
  const reconciles = isArithmeticCorrect && sumMethods === totalPaise;

  return {
    date: dateStr,
    billCount,
    subtotalPaise,
    discountPaise,
    taxPaise,
    roundOffPaise,
    totalPaise,
    byMethod,
    cancelled: {
      count: cancelledCount,
      totalPaise: cancelledTotalPaise
    },
    voidedLines: {
      count: voidedCount,
      valuePaise: voidedValuePaise
    },
    reconciles
  };
}
