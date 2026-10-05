"use server";

import { requireUser } from "@/lib/auth/session";
import { generateBill } from "@/lib/billing/generate";
import { revalidatePath } from "next/cache";

export async function generateBillAction(
  sessionId: string,
  optsInput: {
    discount?: { type: "FLAT" | "PERCENT"; value: number; reason: string };
    customerName?: string;
    customerPhone?: string;
  }
) {
  const user = await requireUser();
  const res = await generateBill(sessionId, optsInput, user);
  if (res.ok) {
    revalidatePath(`/admin/bills/${sessionId}`);
    revalidatePath("/admin/bills");
  }
  return res;
}
