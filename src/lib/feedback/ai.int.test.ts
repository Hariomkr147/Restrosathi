import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../db";
import { generateFeedbackSummary } from "./ai";
import { consumeMonthlyQuota } from "../ai/usage";

// Mock the AI usage cap and getProvider
vi.mock("../ai/usage", () => ({
  consumeMonthlyQuota: vi.fn().mockResolvedValue(true)
}));

vi.mock("../ai", () => ({
  getProvider: () => ({
    complete: vi.fn().mockImplementation(async (prompt) => {
      // check if it stripped PII
      if (prompt.user.includes("1234567890") || prompt.user.includes("test@example.com") || prompt.user.includes("@twitter_user")) {
        throw new Error("PII not stripped");
      }
      return {
        text: JSON.stringify({
          themes: [
            { theme: "Service slow", refs: [0] },
            { theme: "Food cold", refs: [1, 2] },
            { theme: "No parking", refs: [3] }
          ],
          positive: ["Nice ambiance", "Clean"],
          reply: "We are sorry."
        })
      };
    })
  })
}));

describe("AI Feedback Summary", () => {
  beforeEach(async () => {
    await prisma.feedbackSummary.deleteMany({});
    await prisma.feedback.deleteMany({});
    vi.clearAllMocks();
  });

  it("strips PII and creates summary atomically", async () => {
    const start = new Date("2026-10-01T00:00:00Z");
    const end = new Date("2026-10-08T00:00:00Z");

    const user = await prisma.user.create({ data: { phone: "999888777" + Math.random().toString().slice(2, 6), role: "OWNER", name: "test" } });
    
    for (let i = 0; i < 5; i++) {
      const bill = await prisma.bill.create({
        data: {
          totalPaise: 1000,
          gstRatePercent: 0,
          pricesIncludeTax: true,
          header: {},
          subtotalPaise: 1000,
          discountPaise: 0,
          taxableValuePaise: 1000,
          cgstPaise: 0,
          sgstPaise: 0,
          roundOffPaise: 0,
          status: "SETTLED",
          docType: "BILL",
          taxMode: "NONE",
          generatedById: user.id,
          session: {
            create: { kind: "TAKEAWAY" }
          }
        }
      });

      await prisma.feedback.create({
        data: {
          billId: bill.id,
          token: "token" + i,
          tokenExpiresAt: new Date(Date.now() + 100000),
          rating: 2,
          comment: "Horrible 1234567890 and test@example.com @twitter_user " + i,
          submittedAt: new Date("2026-10-05T00:00:00Z")
        }
      });
    }

    const summary = await generateFeedbackSummary(start, end);
    expect(summary).toBeDefined();
    expect((summary?.themes as string[]).length).toBe(3);

    // calling again returns the same object without hitting AI
    const summary2 = await generateFeedbackSummary(start, end);
    expect(summary2?.id).toBe(summary?.id);
  });

  it("returns fallback gracefully if quota exceeded", async () => {
    (consumeMonthlyQuota as any).mockResolvedValueOnce(false);
    
    const start = new Date("2026-10-01T00:00:00Z");
    const end = new Date("2026-10-08T00:00:00Z");

    const user = await prisma.user.create({ data: { phone: "999888777" + Math.random().toString().slice(2, 6), role: "OWNER", name: "test" } });
    
    for (let i = 0; i < 6; i++) {
      const bill = await prisma.bill.create({
        data: {
          totalPaise: 1000,
          gstRatePercent: 0,
          pricesIncludeTax: true,
          header: {},
          subtotalPaise: 1000,
          discountPaise: 0,
          taxableValuePaise: 1000,
          cgstPaise: 0,
          sgstPaise: 0,
          roundOffPaise: 0,
          status: "SETTLED",
          docType: "BILL",
          taxMode: "NONE",
          generatedById: user.id,
          session: {
            create: { kind: "TAKEAWAY" }
          }
        }
      });

      await prisma.feedback.create({
        data: {
          billId: bill.id,
          token: "token_b" + i,
          tokenExpiresAt: new Date(Date.now() + 100000),
          rating: 2,
          comment: "Bad",
          submittedAt: new Date("2026-10-05T00:00:00Z")
        }
      });
    }

    const summary = await generateFeedbackSummary(start, end);
    expect(summary).toBeDefined();
    expect(summary?.themes).toEqual([]);
    expect(summary?.reply).toContain("Thank you");
  });
});
