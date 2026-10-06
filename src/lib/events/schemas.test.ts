import { describe, it, expect } from "vitest";
import { eventPackageSchema, eventEnquiryInputSchema } from "./schemas";

describe("events schemas", () => {
  it("validates eventPackageSchema", () => {
    expect(eventPackageSchema.safeParse({
      name: { en: "Gold" },
      description: { en: "Desc" },
      pricePerPlatePaise: 5000,
      minGuests: 20
    }).success).toBe(true);

    expect(eventPackageSchema.safeParse({
      name: { en: "" }, // min 1
      description: { en: "Desc" },
      pricePerPlatePaise: 5000,
      minGuests: 20
    }).success).toBe(false);

    expect(eventPackageSchema.safeParse({
      name: { en: "Gold" },
      description: { en: "Desc" },
      pricePerPlatePaise: 0, // min 1
      minGuests: 20
    }).success).toBe(false);
  });

  it("validates eventEnquiryInputSchema bounds", () => {
    const valid = {
      eventType: "CORPORATE",
      name: "Acme Corp",
      phone: "9876543210",
      guests: 50,
      eventDate: "2024-12-01",
    };
    expect(eventEnquiryInputSchema.safeParse(valid).success).toBe(true);

    expect(eventEnquiryInputSchema.safeParse({ ...valid, guests: 501 }).success).toBe(false);
    expect(eventEnquiryInputSchema.safeParse({ ...valid, guests: 0 }).success).toBe(false);
    expect(eventEnquiryInputSchema.safeParse({ ...valid, name: "A".repeat(61) }).success).toBe(false);
    expect(eventEnquiryInputSchema.safeParse({ ...valid, eventDate: "2024/12/01" }).success).toBe(false);
  });
});
