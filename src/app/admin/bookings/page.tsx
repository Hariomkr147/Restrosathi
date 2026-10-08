/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { confirmBookingAction, declineBookingAction, setBookingStatusAction } from "./actions";
import { AutoRefresh } from "./Refresh";
import { Booking } from "@prisma/client";

export default async function AdminBookingsPage() {
  const user = await requirePageUser();

  const today = new Date();
  const istNow = new Date(today.getTime() + 5.5 * 60 * 60 * 1000);
  const dateStr = istNow.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  dayStart.setHours(dayStart.getHours() - 5, dayStart.getMinutes() - 30);

  const bookings = await prisma.booking.findMany({
    where: {
      slotStart: { gte: dayStart }
    },
    orderBy: { slotStart: "asc" }
  });

  const settings = await prisma.settings.findFirst();
  const capacity = settings?.bookingCapacityPerSlot || 30;

  // Group by IST Date string
  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const bIst = new Date(b.slotStart.getTime() + 5.5 * 60 * 60 * 1000);
    const bDate = bIst.toISOString().slice(0, 10);
    if (!groups.has(bDate)) groups.set(bDate, []);
    groups.get(bDate)!.push(b);
  }

  const sortedDates = Array.from(groups.keys()).sort();

  return (
    <main className="admin-chrome mx-auto w-full max-w-content px-6 py-6">
      <AutoRefresh intervalMs={10000} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        {user.role === "OWNER" && (
          <Link href="/admin/bookings/blocked" className="text-primary underline inline-flex min-h-touch items-center">
            Manage Blocked Dates
          </Link>
        )}
      </div>

      <div className="space-y-12">
        {sortedDates.length === 0 && (
          <p className="text-muted-foreground">No bookings found.</p>
        )}
        
        {sortedDates.map(date => {
          const dayBookings = groups.get(date)!;
          const requested = dayBookings.filter(b => b.status === "REQUESTED");
          const confirmed = dayBookings.filter(b => b.status === "CONFIRMED");
          const arrived = dayBookings.filter(b => b.status === "ARRIVED");
          
          // Calculate covers booked for this day (rough sum of confirmed+arrived)
          const coversUsed = [...confirmed, ...arrived].reduce((sum, b) => sum + b.partySize, 0);

          return (
            <div key={date} className="border-t pt-8 first:border-0 first:pt-0">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">{new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", month: "long", day: "numeric" })}</h2>
                <p className="text-muted-foreground text-sm">Total confirmed/arrived covers today: {coversUsed}</p>
              </div>

              <div className="space-y-8 pl-4 border-l-2 border-border">
                {requested.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold text-amber-600 mb-3">Requested ({requested.length})</h3>
                    <div className="grid gap-4">
                      {requested.map(b => (
                        <BookingCard key={b.id} booking={b} />
                      ))}
                    </div>
                  </section>
                )}

                {confirmed.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold text-emerald-600 mb-3">Confirmed ({confirmed.length})</h3>
                    <div className="grid gap-4">
                      {confirmed.map(b => (
                        <BookingCard key={b.id} booking={b} />
                      ))}
                    </div>
                  </section>
                )}

                {arrived.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold mb-3">Arrived / Closed ({arrived.length})</h3>
                    <div className="grid gap-4">
                      {arrived.map(b => (
                        <BookingCard key={b.id} booking={b} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function BookingCard({ booking }: { booking: any }) {
  const time = booking.slotStart.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  
  return (
    <div className="border rounded-md p-4 bg-card text-card-foreground shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-lg">{booking.name}</span>
          <span className="bg-muted px-2 py-0.5 rounded text-sm text-muted-foreground">{booking.partySize} pax</span>
        </div>
        <div className="text-sm">
          {time} · {booking.phone}
        </div>
        {booking.note && <div className="text-sm italic text-muted-foreground mt-1">Note: {booking.note}</div>}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {booking.status === "REQUESTED" && (
          <>
            <form action={async () => { "use server"; await confirmBookingAction(booking.id); }}>
              <button className="bg-emerald-600 text-white px-3 py-1.5 rounded min-h-touch text-sm font-medium">Confirm</button>
            </form>
            <form action={async () => { "use server"; await declineBookingAction(booking.id); }}>
              <button className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded min-h-touch text-sm font-medium">Decline</button>
            </form>
          </>
        )}
        {booking.status === "CONFIRMED" && (
          <>
            <form action={async () => { "use server"; await setBookingStatusAction(booking.id, "ARRIVED"); }}>
              <button className="bg-primary text-primary-foreground px-3 py-1.5 rounded min-h-touch text-sm font-medium">Mark Arrived</button>
            </form>
            <form action={async () => { "use server"; await setBookingStatusAction(booking.id, "NO_SHOW"); }}>
              <button className="bg-muted text-muted-foreground px-3 py-1.5 rounded min-h-touch text-sm font-medium">No-Show</button>
            </form>
            <form action={async () => { "use server"; await setBookingStatusAction(booking.id, "CANCELLED"); }}>
              <button className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded min-h-touch text-sm font-medium">Cancel</button>
            </form>
          </>
        )}
        {booking.status === "ARRIVED" && (
          <span className="text-muted-foreground text-sm font-medium px-2 py-1 bg-muted rounded">Arrived</span>
        )}
      </div>
    </div>
  );
}
