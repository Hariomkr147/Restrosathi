/* eslint-disable @typescript-eslint/no-unused-vars */
"use server";

import { requireUser } from "@/lib/auth/session";
import { generateBill } from "@/lib/billing/generate";
import { revalidatePath } from "next/cache";

export async function generateBillAction(
  sessionId: string,
  optsInput: {
    discount?: { type: "FLAT" | "PERCENT"; value: number; reason: string } | null;
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
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { upsertCustomer } from "@/lib/customers";

export async function verifyBillPhoneAction(billId: string, rawPhone: string, code: string) {
  const user = await requireUser();
  const res = await verifyOtp(rawPhone, code, {});
  if (!res.ok) return res;
  
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false as const, error: "INVALID_PHONE" };
  
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Bill" WHERE id = ${billId} FOR UPDATE`;
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
  await removeRedemption(billId);
  revalidatePath(`/admin/bills`);
}
