"use server";

import { requireUser } from "@/lib/auth/session";
import { createStaffOrder, staffOrderInput } from "@/lib/orders/staff-order";
import { revalidatePath } from "next/cache";

export async function placeStaffOrderAction(input: unknown) {
  const user = await requireUser();
  const parsed = staffOrderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const res = await createStaffOrder(parsed.data, user.id);
  if (res.ok) {
    revalidatePath("/admin/board");
  }
  return res;
}
