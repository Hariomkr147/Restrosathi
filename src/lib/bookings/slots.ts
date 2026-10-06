import type { Hours } from "../settings/schema";

export function isAligned(date: Date): boolean {
  return (date.getMinutes() === 0 || date.getMinutes() === 30) && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}

export function occupiedSlots(start: Date): Date[] {
  return [
    start,
    new Date(start.getTime() + 30 * 60 * 1000),
    new Date(start.getTime() + 60 * 60 * 1000),
  ];
}

export function bookableSlots(
  dateStr: string,
  hours: Hours,
  nowMs: number,
  settings: { bookingCutoffMinutes: number },
  blockedDates: string[]
): Date[] {
  if (blockedDates.includes(dateStr)) return [];

  const targetDate = new Date(`${dateStr}T00:00:00.000+05:30`);
  const now = new Date(nowMs);
  const cutoffTime = nowMs + settings.bookingCutoffMinutes * 60 * 1000;
  
  // 60 days ahead calculation (midnight to midnight local)
  const todayStr = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date(`${todayStr}T00:00:00.000+05:30`);
  const daysDiff = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 60 || daysDiff < 0) return [];

  const dayOfWeekNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const dayName = dayOfWeekNames[targetDate.getDay()];
  const shifts = hours[dayName];
  if (!shifts || shifts.length === 0) return [];

  const slots: Date[] = [];
  
  for (const shift of shifts) {
    const [openH, openM] = shift.open.split(":").map(Number);
    const [closeH, closeM] = shift.close.split(":").map(Number);
    
    const shiftStart = new Date(targetDate);
    shiftStart.setHours(openH, openM, 0, 0);

    const shiftEnd = new Date(targetDate);
    shiftEnd.setHours(closeH, closeM, 0, 0);

    // handle overnight shift: if close time is earlier than open time, the close time is on the next day
    if (shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    // A booking occupies 90 min (3 consecutive slots). 
    // The last bookable slot start is 90 mins before the shift end.
    const lastBookableStart = new Date(shiftEnd.getTime() - 90 * 60 * 1000);

    let current = shiftStart;
    while (current <= lastBookableStart) {
      if (current.getTime() >= cutoffTime) {
        slots.push(current);
      }
      current = new Date(current.getTime() + 30 * 60 * 1000);
    }
  }

  return slots;
}
