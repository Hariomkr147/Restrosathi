import { verifyCronSecret } from "@/lib/cron";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const feedback = await prisma.feedback.findMany({
    where: {
      submittedAt: { gte: sevenDaysAgo },
      rating: { not: null }
    }
  });

  if (feedback.length === 0) {
    return NextResponse.json({ message: "No feedback in the last 7 days." });
  }

  const items = feedback.map(f => `Rating: ${f.rating}/5. Comment: ${f.comment || "None"}`).join("\n");

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: "You are an operations assistant for Saffron Tadka.",
    prompt: `Read this feedback. Summarize the main positive and negative themes in 2-3 sentences. Do not mention individual names. Keep it factual.\n\nFeedback:\n${items}`
  });

  // For now, just console.log the result; it will be emailed or texted in a future phase.
  console.log("Weekly Feedback Themes:", text);

  return NextResponse.json({ themes: text });
}
