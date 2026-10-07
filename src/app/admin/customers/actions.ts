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
