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
  if (res.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/admin/bills/view/${res.billId}`);
  }
  return res;
}

import { settleBill } from "@/lib/billing/settle";

export async function settleBillAction(
  billId: string,
  payments: Array<{ method: "CASH" | "UPI" | "CARD"; amountPaise: number }>,
  expectedTotalPaise: number
) {
  const user = await requireUser();
  const res = await settleBill(billId, payments, user, { expectedTotalPaise });
  if (res.ok) {
    revalidatePath("/admin/bills");
  }
  return res;
}

import { cancelBill } from "@/lib/billing/cancel";

export async function cancelBillAction(billId: string, reason: string) {
  const user = await requireUser("OWNER");
  const res = await cancelBill(billId, reason, user);
  if (res.ok) {
    revalidatePath("/admin/bills/history");
    revalidatePath(`/admin/bills/view/${billId}`);
  }
  return res;
}
