import { BookingStatus } from "@prisma/client";

export function canBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  
  if (from === BookingStatus.REQUESTED) {
    return to === BookingStatus.CONFIRMED || to === BookingStatus.DECLINED || to === BookingStatus.CANCELLED;
  }
  
  if (from === BookingStatus.CONFIRMED) {
    return to === BookingStatus.ARRIVED || to === BookingStatus.NO_SHOW || to === BookingStatus.CANCELLED;
  }
  
  return false;
}
