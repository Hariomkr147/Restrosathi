import { mockCookies, asOwner } from "../../../tests/helpers/auth";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { submitEnquiry, getEnquiries, updateEnquiryStatusAction } from "./enquiries";
import { upsertPackageAction, getAllPackages } from "./packages";
import { prisma } from "../db";




describe("events integration", () => {
  beforeEach(async () => {
    mockCookies();
    await prisma.eventEnquiry.deleteMany();
    await prisma.eventPackage.deleteMany();
  });

  afterEach(async () => {
    await prisma.eventEnquiry.deleteMany();
    await prisma.eventPackage.deleteMany();
  });

  it("creates packages as owner", async () => {
    await asOwner();
    await upsertPackageAction(null, {
      name: { en: "Test Package" },
      description: { en: "Test Desc" },
      pricePerPlatePaise: 1000,
      minGuests: 10,
      active: true,
      sortOrder: 0
    });
    
    const pkgs = await getAllPackages();
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0].pricePerPlatePaise).toBe(1000);
  });

  it("submits enquiry and transitions status", async () => {
    const ctx = { ip: "127.0.0.1", now: new Date("2026-10-06T12:00:00Z") };
    const res = await submitEnquiry({
      eventType: "CORPORATE",
      name: "Alice",
      phone: "9876543210",
      guests: 20,
      eventDate: "2026-10-10",
    }, ctx);
    
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("Failed to submit");

    await asOwner();
    const transition1 = await updateEnquiryStatusAction(res.enquiryId, "QUOTED", "Need 20 plates", 20000);
    expect(transition1.ok).toBe(true);

    const transition2 = await updateEnquiryStatusAction(res.enquiryId, "CONFIRMED");
    expect(transition2.ok).toBe(true);

    const enqs = await getEnquiries();
    expect(enqs[0].status).toBe("CONFIRMED");
  });

  it("rejects invalid enquiries", async () => {
    const ctx = { ip: "127.0.0.1", now: new Date("2026-10-06T12:00:00Z") };
    
    const pastRes = await submitEnquiry({
      eventType: "OTHER", name: "Bob", phone: "9876543210", guests: 10, eventDate: "2026-10-01"
    }, ctx);
    expect(pastRes.ok).toBe(false);
  });
});
