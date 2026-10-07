"use server";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function draftReplyAction(feedbackId: string) {
  const user = await requireUser();
  if (user.role !== "STAFF" && user.role !== "OWNER") {
    return { ok: false, error: "FORBIDDEN" };
  }

  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb) return { ok: false, error: "NOT_FOUND" };
  if (!fb.rating) return { ok: false, error: "NO_RATING" };

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: "You are the manager at Saffron Tadka.",
    prompt: `Draft a polite 1-2 sentence WhatsApp reply to this customer feedback. Acknowledge the rating (${fb.rating}/5). If there is a comment (${fb.comment || ""}), address it. Keep it conversational. Just output the draft text.`
  });

  return { ok: true, draft: text };
}
