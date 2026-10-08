/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { prisma } from "../../lib/db";
import { recordConsent, hasMarketingConsent, getMarketingAudience } from "./consent";
import { upsertCustomer } from "./index";

beforeAll(async () => {
  await prisma.consentRecord.deleteMany();
  await prisma.optOut.deleteMany();
  await prisma.customer.deleteMany();
});

afterEach(async () => {
  await prisma.consentRecord.deleteMany();
  await prisma.optOut.deleteMany();
  await prisma.customer.deleteMany();
});

describe("consent", () => {
  test("latest consent wins, records are appended", async () => {
    const c = await upsertCustomer("9999911111");
    
    await recordConsent(c.id, true, "BILLING");
    expect(await hasMarketingConsent(c.id)).toBe(true);
    
    // Revoke
    await recordConsent(c.id, false, "ADMIN");
    expect(await hasMarketingConsent(c.id)).toBe(false);
    
    // Grant again
    await recordConsent(c.id, true, "BOOKING");
    expect(await hasMarketingConsent(c.id)).toBe(true);
    
    const records = await prisma.consentRecord.findMany({ where: { customerId: c.id } });
    expect(records).toHaveLength(3);
  });

  test("getMarketingAudience includes only granted and not opted-out", async () => {
    const cGranted = await upsertCustomer("9999922222");
    await recordConsent(cGranted.id, true, "BILLING");
    
    const cNeverAsked = await upsertCustomer("9999933333");
    
    const cRevoked = await upsertCustomer("9999944444");
    await recordConsent(cRevoked.id, true, "BILLING");
    await recordConsent(cRevoked.id, false, "ADMIN");
    
    const cStop = await upsertCustomer("9999955555");
    await recordConsent(cStop.id, true, "BILLING");
    await prisma.optOut.create({ data: { phone: cStop.phone } });
    
    const cStopViaConsent = await upsertCustomer("9999966666");
    await recordConsent(cStopViaConsent.id, false, "WHATSAPP_STOP");
    
    const audience = await getMarketingAudience();
    expect(audience).toHaveLength(1);
    expect(audience[0].id).toBe(cGranted.id);
  });

  test("transaction rollback preserves previous consent state", async () => {
    const c = await upsertCustomer("9999977777");
    await recordConsent(c.id, true, "BILLING");
    
    try {
      await prisma.$transaction(async (tx) => {
        await recordConsent(c.id, false, "ADMIN", undefined, tx);
        throw new Error("ROLLBACK");
      });
    } catch {}

    expect(await hasMarketingConsent(c.id)).toBe(true);
    const records = await prisma.consentRecord.findMany({ where: { customerId: c.id } });
    expect(records).toHaveLength(1);
  });

  test("concurrent appends record all entries", async () => {
    const c = await upsertCustomer("9999988888");
    await Promise.all([
      recordConsent(c.id, true, "BILLING"),
      recordConsent(c.id, false, "WHATSAPP_STOP"),
      recordConsent(c.id, true, "BOOKING")
    ]);

    const records = await prisma.consentRecord.findMany({ where: { customerId: c.id } });
    expect(records).toHaveLength(3);
  });
});
