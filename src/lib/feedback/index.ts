import { prisma } from "../db";

export async function submitFeedback(token: string, input: { rating: number; comment?: string }) {
  if (input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
    return { ok: false, error: "INVALID_RATING" };
  }
  if (input.comment && input.comment.length > 500) {
    return { ok: false, error: "COMMENT_TOO_LONG" };
  }

  const fb = await prisma.feedback.findUnique({ where: { token } });
  if (!fb) return { ok: false, error: "NOT_FOUND" };
  
  if (fb.tokenExpiresAt < new Date()) {
    return { ok: false, error: "EXPIRED" };
  }

  if (fb.submittedAt) {
    return { ok: false, error: "ALREADY_SUBMITTED" };
  }

  const res = await prisma.feedback.updateMany({
    where: { 
      token,
      submittedAt: null
    },
    data: {
      rating: input.rating,
      comment: input.comment,
      submittedAt: new Date()
    }
  });

  if (res.count === 0) {
    // If count is 0, it means either token doesn't exist or it was concurrently submitted
    const check = await prisma.feedback.findUnique({ where: { token } });
    if (check?.submittedAt) {
      return { ok: false, error: "ALREADY_SUBMITTED" };
    }
    return { ok: false, error: "UPDATE_FAILED" };
  }

  return { ok: true };
}
