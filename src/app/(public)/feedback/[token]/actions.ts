"use server";

import { submitFeedback } from "@/lib/feedback";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRate } from "@/lib/rate-limit";

export async function submitFeedbackAction(token: string, rating: number, comment?: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for") || "127.0.0.1";
  
  if (!(await checkRate(`feedback:ip:${ip}`, 20, 60 * 60 * 1000))) {
    return { ok: false, error: "RATE_LIMITED" };
  }
  
  if (!(await checkRate(`feedback:token:${token}`, 5, 60 * 60 * 1000))) {
    return { ok: false, error: "RATE_LIMITED" };
  }

  const res = await submitFeedback(token, { rating, comment });
  if (res.ok) {
    revalidatePath(`/feedback/${token}`);
    revalidatePath(`/admin/feedback`);
  }
  return res;
}
