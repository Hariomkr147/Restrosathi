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
    marketingConsent?: boolean;
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

import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/db";
import { upsertCustomer } from "@/lib/customers";

export async function verifyBillPhoneAction(billId: string, phone: string, code: string) {
  const user = await requireUser();
  const res = await verifyOtp(phone, code);
  if (!res.ok) return res;
  
  await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: billId } });
    if (!bill || bill.status !== "OPEN") return;
    if (bill.customerPhone !== phone) return;
    
    await upsertCustomer(phone, { verified: true }, tx);
    await tx.bill.update({
      where: { id: billId },
      data: { phoneVerifiedAt: new Date() }
    });
  });
  
  revalidatePath(`/admin/bills/view/${billId}`);
  // Also revalidate the sessionId page
  return { ok: true };
}

import { applyRedemption, removeRedemption } from "@/lib/loyalty";

export async function applyRedemptionAction(billId: string, points: number) {
  const user = await requireUser();
  const res = await applyRedemption(billId, points, user.id);
  if (res) revalidatePath(`/admin/bills`); // Revalidate any paths necessary
  return res;
}

export async function removeRedemptionAction(billId: string) {
  const user = await requireUser();
  await removeRedemption(billId, user.id);
  revalidatePath(`/admin/bills`);
}
