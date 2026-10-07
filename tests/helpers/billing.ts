import { db } from './db';

export async function createSettledBill(sessionId: string, totalPaise: number, taxMode: "NONE" | "REGULAR" | "COMPOSITION" = "NONE") {
  const owner = await db.user.findFirst({ where: { role: "OWNER" } });
  const bill = await db.bill.create({
    data: {
      number: "INV-TEST-1",
      docType: taxMode === "REGULAR" ? "TAX_INVOICE" : "BILL",
      header: {},
      generatedById: owner!.id,
      sessionId,
      subtotalPaise: totalPaise,
      taxableValuePaise: totalPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      roundOffPaise: 0,
      totalPaise: totalPaise,
      discountPaise: 0,
      taxMode,
      gstRatePercent: taxMode === "REGULAR" ? 5 : 0,
      pricesIncludeTax: false,
      status: "SETTLED",
      settledAt: new Date(),
      settledById: owner?.id,
      customerPhone: "+919999999999",
      phoneVerifiedAt: new Date(),
    }
  });
  await db.payment.create({
    data: {
      billId: bill.id,
      method: "CASH",
      amountPaise: totalPaise,
      recordedById: owner!.id
    }
  });
  const order = await db.order.findFirst({ where: { sessionId } });
  await db.billLine.create({
    data: {
      billId: bill.id,
      name: { en: "Test Item" },
      modifiers: {},
      qty: 1,
      unitPricePaise: totalPaise,
      linePaise: totalPaise
    }
  });
  await db.diningSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED" }
  });
  return bill;
}

export async function createCancelledBill(sessionId: string, totalPaise: number) {
  const owner = await db.user.findFirst({ where: { role: "OWNER" } });
  const bill = await db.bill.create({
    data: {
      number: "INV-TEST-2",
      docType: "BILL",
      header: {},
      generatedById: owner!.id,
      sessionId,
      subtotalPaise: totalPaise,
      taxableValuePaise: totalPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      roundOffPaise: 0,
      totalPaise: totalPaise,
      discountPaise: 0,
      taxMode: "NONE",
      gstRatePercent: 0,
      pricesIncludeTax: false,
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: owner?.id,
      cancelReason: "Test",
    }
  });
  const order = await db.order.findFirst({ where: { sessionId } });
  await db.billLine.create({
    data: {
      billId: bill.id,
      name: { en: "Test Item" },
      modifiers: {},
      qty: 1,
      unitPricePaise: totalPaise,
      linePaise: totalPaise
    }
  });
  await db.diningSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED" }
  });
  return bill;
}
