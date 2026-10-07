/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requireUser } from "@/lib/auth/session";
import { eraseCustomer } from "@/lib/customers/erase";
import { recordConsent } from "@/lib/customers/consent";
import { revalidatePath } from "next/cache";

export async function eraseCustomerAction(customerId: string) {
  const user = await requireUser("OWNER");
  try {
    await eraseCustomer(customerId, user);
    revalidatePath("/admin/customers");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function recordConsentAction(customerId: string, granted: boolean) {
  const user = await requireUser("OWNER");
  await recordConsent(customerId, granted, "ADMIN", user.id);
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true };
}

export async function draftCampaignAction() {
  const user = await requireUser();
  if (user.role !== "STAFF" && user.role !== "OWNER") {
    return { ok: false, error: "FORBIDDEN" };
  }

  const { generateText } = await import("ai");
  const { google } = await import("@ai-sdk/google");

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: "You are the marketing manager at Saffron Tadka.",
    prompt: `Write a short, engaging 2-sentence WhatsApp promo for Saffron Tadka. Mention a generic special offer or welcoming message. Use emojis. Just output the draft text.`
  });

  return { ok: true, draft: text };
}
