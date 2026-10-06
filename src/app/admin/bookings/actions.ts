"use server";

import { requirePageUser } from "@/lib/auth/session";
import { confirmBooking, declineBooking } from "@/lib/bookings/confirm";
import { markBookingStatus } from "@/lib/bookings/status";
import { BookingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function confirmBookingAction(bookingId: string) {
  const user = await requirePageUser();
  const res = await confirmBooking(bookingId, user.id);
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function declineBookingAction(bookingId: string, reason?: string) {
  const user = await requirePageUser();
  const res = await declineBooking(bookingId, reason, user.id);
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function setBookingStatusAction(bookingId: string, status: BookingStatus) {
  const user = await requirePageUser();
  const res = await markBookingStatus(bookingId, status, user.id);
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/admin/bookings");
  return { ok: true };
}
