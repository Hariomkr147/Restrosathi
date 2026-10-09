/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { prisma } from "../../lib/db";
import { eraseCustomer, HANDLED_MODELS } from "./erase";
import { upsertCustomer } from "./index";
import { Prisma } from "@prisma/client";

beforeAll(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany({ where: { id: "user1" } });
});

afterEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany({ where: { id: "user1" } });
});

describe("erasure completeness", () => {
  test("Prisma DMMF walk verifies all PII fields are handled", () => {
    // These models explicitly contain no personal data related to a customer phone/name
    const NOT_PERSONAL = new Set([
      "Category", "MenuItem", "Table", "Settings", "InvoiceCounter", "OptOut", "User", "AuditLog", "MenuCategory", "MenuVariant", "MenuModifier", "BillLine", "ModifierGroup", "ModifierOption", "EventPackage"
    ]);

    const PII_FIELDS = ["phone", "name", "customerName", "customerPhone", "customerId"];

    for (const model of Prisma.dmmf.datamodel.models) {
      if (NOT_PERSONAL.has(model.name)) continue;
      
      const hasPii = model.fields.some(f => PII_FIELDS.includes(f.name));
      if (hasPii) {
        expect(HANDLED_MODELS.includes(model.name), `Model ${model.name} contains PII but is not handled in erase.ts`).toBe(true);
      }
    }
  });
});

describe("eraseCustomer", () => {
  test("removes personal data but keeps bill totals and optout", async () => {
    const c = await upsertCustomer("9999977777", { name: "Bob" });
    await prisma.consentRecord.create({ data: { customerId: c.id, purpose: "MARKETING", granted: true, textVersion: "1", source: "BILLING" } });
    await prisma.optOut.create({ data: { phone: c.phone } });
    const s = await prisma.diningSession.create({ data: { kind: "TAKEAWAY", customerName: "Bob", customerPhone: c.phone } });
    const b = await prisma.bill.create({
      data: {
        sessionId: s.id,
        status: "SETTLED",
        number: "INV-1",
        subtotalPaise: 10000,
        taxableValuePaise: 10000,
        cgstPaise: 0,
        sgstPaise: 0,
        discountPaise: 0,
        roundOffPaise: 0,
        totalPaise: 10000,
        customerName: "Bob",
        customerPhone: c.phone,
        generatedAt: new Date(),
        settledAt: new Date(),
        docType: "BILL",
        taxMode: "NONE",
        gstRatePercent: 0,
        pricesIncludeTax: false,
        header: {},
        generatedById: "user1"
      }
    });

    await prisma.feedback.create({ data: { billId: b.id, customerId: c.id, token: "fbtoken", tokenExpiresAt: new Date(Date.now() + 86400000) } });

    const booking = await prisma.booking.create({
      data: { name: "Bob", phone: c.phone, partySize: 2, slotStart: new Date(), cancelToken: "test" }
    });

    await prisma.loyaltyTxn.create({
      data: { customerId: c.id, kind: "EARN", points: 10, billId: b.id, actorId: "user1" }
    });

    await prisma.user.create({ data: { id: "user1", phone: "+919999900000", passwordHash: "x", role: "OWNER", name: "Owner" } });
    await eraseCustomer(c.id, { id: "user1", role: "OWNER" });

    // Customer should be anonymized
    const afterC = await prisma.customer.findUnique({ where: { id: c.id } });
    expect(afterC).not.toBeNull();
    expect(afterC!.name).toBe("Anonymous");
    expect(afterC!.phone).toContain("+00deleted");

    // Feedback should be deleted
    const fb = await prisma.feedback.findUnique({ where: { token: "fbtoken" } });
    expect(fb).toBeNull();

    // LoyaltyTxn should be deleted
    const txn = await prisma.loyaltyTxn.findFirst({ where: { customerId: c.id } });
    expect(txn).toBeNull();

    // Bill should remain but anonymised
    const afterB = await prisma.bill.findUnique({ where: { id: b.id } });
    expect(afterB).not.toBeNull();
    expect(afterB!.totalPaise).toBe(10000);
    expect(afterB!.customerName).toBeNull();
    expect(afterB!.customerPhone).toBeNull();

    // Session should be anonymised
    const afterS = await prisma.diningSession.findUnique({ where: { id: s.id } });
    expect(afterS!.customerName).toBe("Deleted");
    expect(afterS!.customerPhone).toMatch(/^\+00deleted/);

    // Booking anonymised
    const afterBook = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(afterBook!.name).toBe("Deleted");
    expect(afterBook!.phone).toContain("+00deleted");

    // OptOut remains
    const opt = await prisma.optOut.findUnique({ where: { phone: c.phone } });
    expect(opt).not.toBeNull();

    // Audit log has no PII
    const log = await prisma.auditLog.findFirst({ where: { action: "customer.erase" } });
    expect(log).not.toBeNull();
    expect((log!.data as any).phone).toBeUndefined();
    expect((log!.data as any).name).toBeUndefined();
    expect(log!.entityId).toBe(c.id);
  });

  test("rejects non-owner", async () => {
    const c = await upsertCustomer("9999988888", { name: "Alice" });
    await expect(eraseCustomer(c.id, { id: "user1", role: "STAFF" })).rejects.toThrow();
  });
});
