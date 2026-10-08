import { prisma } from "../db";
import { consumeMonthlyQuota } from "../ai/usage";
import { getProvider } from "../ai";
import { z } from "zod";

const aiResponseSchema = z.object({
  themes: z.array(z.string()).max(3),
  positive: z.array(z.string()).max(2),
  reply: z.string()
});

function stripPii(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b\d{8,14}\b/g, '[PHONE]')
    .replace(/\S+@\S+\.\S+/g, '[EMAIL]')
    .replace(/@[a-zA-Z0-9_]+/g, '[HANDLE]');
}

export async function generateFeedbackSummary(startAt: Date, endAt: Date) {
  // Check if we already have one
  const existing = await prisma.feedbackSummary.findFirst({
    where: { startAt, endAt }
  });
  if (existing) return existing;

  const feedbacks = await prisma.feedback.findMany({
    where: {
      submittedAt: { gte: startAt, lt: endAt },
      comment: { not: null }
    }
  });

  if (feedbacks.length === 0) {
    return null;
  }

  // Quota check
  const allowed = await consumeMonthlyQuota();
  if (!allowed) {
    return null;
  }

  const bad = feedbacks.filter(f => f.comment && f.comment.trim() !== "" && f.rating && f.rating <= 3).map(f => stripPii(f.comment!));
  const good = feedbacks.filter(f => f.comment && f.comment.trim() !== "" && f.rating && f.rating > 3).map(f => stripPii(f.comment!));

  const prompt = `You are a restaurant manager's assistant. Analyze the following 7-day feedback.
Good feedback:
${good.join("\n- ")}

Bad feedback:
${bad.join("\n- ")}

Return exactly a JSON object with:
- "themes": array of exactly 3 negative or improvement themes (strings)
- "positive": array of exactly 2 positive areas (strings)
- "reply": a drafted owner reply to the worst piece of feedback (string)

Return ONLY valid JSON.`;

  try {
    const ai = getProvider();
    const res = await ai.complete({
      system: "You output JSON.",
      user: prompt
    });

    const parsed = aiResponseSchema.parse(JSON.parse(res.text));

    // Persist atomically
    const summary = await prisma.feedbackSummary.create({
      data: {
        startAt,
        endAt,
        themes: parsed.themes,
        positive: parsed.positive,
        reply: parsed.reply
      }
    });
    
    return summary;
  } catch (err) {
    console.error("Feedback AI failure", err);
    return null;
  }
}
