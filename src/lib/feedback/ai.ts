import { prisma } from "../db";
import { consumeMonthlyQuota } from "../ai/usage";
import { getProvider } from "../ai";
import { z } from "zod";

const aiResponseSchema = z.object({
  themes: z.array(z.object({
    theme: z.string(),
    refs: z.array(z.number())
  })).max(3),
  positive: z.array(z.string()).max(2),
  reply: z.string().max(400).refine(s => !/(refund|free|discount|\d+%|\d+rs|http|www\.)/i.test(s), "Unsafe content in reply")
});

function stripPii(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b\d{8,14}\b/g, '[PHONE]')
    .replace(/\S+@\S+\.\S+/g, '[EMAIL]')
    .replace(/@[a-zA-Z0-9_]+/g, '[HANDLE]');
}

export async function generateFeedbackSummary(startAt: Date, endAt: Date) {
  const existing = await prisma.feedbackSummary.findFirst({
    where: { startAt, endAt }
  });
  if (existing) return existing;

  const feedbacks = await prisma.feedback.findMany({
    where: {
      submittedAt: { gte: startAt, lt: endAt },
      comment: { not: null, notIn: [""] }
    },
    take: 100,
    orderBy: { submittedAt: 'desc' }
  });

  const fallback = {
    themes: [],
    positive: [],
    reply: "Thank you for your feedback. We are always looking to improve and appreciate your input."
  };

  if (feedbacks.length < 5) {
    return await prisma.feedbackSummary.create({
      data: { startAt, endAt, ...fallback }
    });
  }

  const allowed = await consumeMonthlyQuota();
  if (!allowed) {
    return await prisma.feedbackSummary.create({
      data: { startAt, endAt, ...fallback }
    });
  }

  const bad = feedbacks.filter(f => f.rating && f.rating <= 3).map(f => stripPii(f.comment!));
  const good = feedbacks.filter(f => f.rating && f.rating > 3).map(f => stripPii(f.comment!));

  const prompt = `You are a restaurant manager's assistant. Analyze the following 7-day feedback.
Good feedback:
${good.map((f, i) => `[${i}] ${f}`).join("\n")}

Bad feedback:
${bad.map((f, i) => `[${i}] ${f}`).join("\n")}

Return exactly a JSON object with:
- "themes": array of up to 3 objects, each with:
    "theme": string
    "refs": array of integer indices from the bad feedback matching this theme
- "positive": array of exactly 2 positive areas (strings)
- "reply": a drafted owner reply to the worst piece of feedback (string, max 400 chars, NO URLs, NO discounts/refunds)

Return ONLY valid JSON.`;

  try {
    const ai = getProvider();
    const res = await ai.complete({
      system: "You output JSON.",
      user: prompt
    });

    const parsed = aiResponseSchema.parse(JSON.parse(res.text));

    // Calculate counts in code, dropping invalid references
    const structuredThemes = parsed.themes.map(t => {
      const validRefs = new Set(t.refs.filter(r => r >= 0 && r < bad.length));
      return {
        theme: t.theme,
        count: validRefs.size
      };
    }).filter(t => t.count > 0);

    return await prisma.feedbackSummary.create({
      data: {
        startAt,
        endAt,
        themes: structuredThemes,
        positive: parsed.positive,
        reply: parsed.reply
      }
    });
  } catch (err) {
    console.error("Feedback AI failure", err);
    return await prisma.feedbackSummary.create({
      data: { startAt, endAt, ...fallback }
    });
  }
}
