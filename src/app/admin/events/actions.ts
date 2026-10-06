"use server";

import { upsertPackageAction } from "@/lib/events/packages";
import { updateEnquiryStatusAction } from "@/lib/events/enquiries";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eventPackageSchema } from "@/lib/events/schemas";

export async function adminUpsertPackageAction(id: string | null, data: z.infer<typeof eventPackageSchema>) {
  console.log("adminUpsertPackageAction called:", id, data);
  const res = await upsertPackageAction(id, data);
  if (res.ok) {
    revalidatePath("/admin/events/packages");
    revalidatePath("/events");
  }
  return res;
}

export async function adminUpdateEnquiryStatusAction(id: string, newStatus: "QUOTED" | "CONFIRMED" | "LOST", notes?: string, quotedPaise?: number) {
  const res = await updateEnquiryStatusAction(id, newStatus, notes, quotedPaise);
  if (res.ok) {
    revalidatePath("/admin/events");
  }
  return res;
}
