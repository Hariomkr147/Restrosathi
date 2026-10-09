import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../db';
import { getMarketingAudience } from './segments';
import { generateMarketingVariants } from './ai';

vi.mock("../ai", () => ({
  getProvider: () => ({
    complete: vi.fn().mockImplementation(async (prompt) => {
      const goal = prompt.user.match(/Goal: "(.*)"/)?.[1] || "";
      
      if (goal === "Bad variants test") {
        return {
          text: JSON.stringify({
            variants: [
              "We have 50% off! APP_URL", // invented number
              "Check this http://example.com", // bad link
              "Hi {name}, hi {name} STOP" // double placeholder
            ]
          })
        };
      }
      
      return {
        text: JSON.stringify({
          variants: [
            `Good variant matching ${goal} APP_URL STOP`,
            `Another ${goal} {name} STOP`,
            `Third ${goal} STOP`
          ]
        })
      };
    })
  })
}));

describe('Marketing AI and Segments', () => {
  beforeEach(async () => {
    await prisma.campaignSend.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.consentRecord.deleteMany();
    await prisma.customer.deleteMany();
  });

  it('filters audience correctly based on consent and frequency', async () => {
    const c1 = await prisma.customer.create({ data: { phone: "+910000000001" } });
    const c2 = await prisma.customer.create({ data: { phone: "+910000000002" } });
    const c3 = await prisma.customer.create({ data: { phone: "+910000000003" } });

    // c1: consented
    await prisma.consentRecord.create({
      data: { customerId: c1.id, purpose: "MARKETING", granted: true, textVersion: "v1", source: "ADMIN" }
    });
    // c2: consented but revoked
    await prisma.consentRecord.create({
      data: { customerId: c2.id, purpose: "MARKETING", granted: true, textVersion: "v1", source: "ADMIN", at: new Date(Date.now() - 1000) }
    });
    await prisma.consentRecord.create({
      data: { customerId: c2.id, purpose: "MARKETING", granted: false, textVersion: "v1", source: "ADMIN", at: new Date() }
    });
    // c3: consented but received a campaign 2 days ago
    await prisma.consentRecord.create({
      data: { customerId: c3.id, purpose: "MARKETING", granted: true, textVersion: "v1", source: "ADMIN" }
    });
    const user = await prisma.user.create({ data: { name: "Admin", role: "OWNER" } });
    const camp = await prisma.campaign.create({
      data: { goal: "test", segment: "ALL", createdById: user.id }
    });
    
    await prisma.campaignSend.create({
      data: { campaignId: camp.id, customerId: c3.id, phone: c3.phone, status: "SENT", sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
    });
    
    const audience = await getMarketingAudience("ALL");
    
    // Only c1 should be eligible
    expect(audience.length).toBe(1);
    expect(audience[0].phone).toBe("+910000000001");
  });

  it('validates marketing variants strictly', async () => {
    await expect(generateMarketingVariants("Bad variants test")).rejects.toThrow("Variant contained invented numbers");
    const goodVariants = await generateMarketingVariants("Good goal 20% off");
    expect(goodVariants.length).toBe(3);
    expect(goodVariants[0]).toContain("STOP");
  });
});
