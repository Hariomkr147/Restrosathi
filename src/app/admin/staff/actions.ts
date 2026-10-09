"use server";

import { createStaff, resetStaffPin, setStaffActive, changeOwnerPassword } from "@/lib/auth/accounts";
import { revalidatePath } from "next/cache";

export async function createStaffAction(formData: FormData) {
  const name = formData.get("name") as string;
  const pin = formData.get("pin") as string;

  if (!name || name.trim().length === 0) {
    return { error: "Name is required" };
  }
  
  if (!/^\d{4,6}$/.test(pin)) {
    return { error: "PIN must be 4 to 6 digits" };
  }

  try {
    await createStaff({ name, pin });
  } catch (err: any) {
    return { error: err.message };
  }

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function resetStaffPinAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const pin = formData.get("pin") as string;

  if (!/^\d{4,6}$/.test(pin)) {
    return { error: "PIN must be 4 to 6 digits" };
  }

  try {
    await resetStaffPin(userId, pin);
  } catch (err: any) {
    return { error: err.message };
  }

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function setStaffActiveAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const activeStr = formData.get("active") as string;
  const active = activeStr === "true";

  try {
    await setStaffActive(userId, active);
  } catch (err: any) {
    return { error: err.message };
  }

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function changeOwnerPasswordAction(formData: FormData) {
  const current = formData.get("current") as string;
  const next = formData.get("next") as string;

  if (!next || next.length < 10) {
    return { error: "New password must be at least 10 characters" };
  }

  try {
    await changeOwnerPassword(current, next);
  } catch (err: any) {
    return { error: err.message };
  }

  return { success: true };
}
