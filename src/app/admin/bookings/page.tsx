/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { confirmBookingAction, declineBookingAction, setBookingStatusAction } from "./actions";

export default async function AdminBookingsPage() {
  await requirePageUser();

  const today = new Date();
  today.setHours(today.getHours() + 5, today.getMinutes() + 30);
  const dateStr = today.toISOString().slice(0, 10);
  const dayStart = new Date(dateStr + "T00:00:00Z");
  dayStart.setHours(dayStart.getHours() - 5, dayStart.getMinutes() - 30);

  const bookings = await prisma.booking.findMany({
    where: {
      slotStart: { gte: dayStart }
    },
    orderBy: { slotStart: "asc" }
  });

  const requested = bookings.filter(b => b.status === "REQUESTED");
  const confirmed = bookings.filter(b => b.status === "CONFIRMED");
  const arrived = bookings.filter(b => b.status === "ARRIVED");

  return (
    <main className="admin-chrome mx-auto w-full max-w-content px-6 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Link href="/admin/bookings/blocked" className="text-primary underline inline-flex min-h-touch items-center">
          Manage Blocked Dates
        </Link>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold text-amber-600 mb-4">Requested ({requested.length})</h2>
          <div className="grid gap-4">
            {requested.map(b => (
              <BookingCard key={b.id} booking={b} />
            ))}
            {requested.length === 0 && <p className="text-muted-foreground text-sm">No new requests.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-emerald-600 mb-4">Confirmed ({confirmed.length})</h2>
          <div className="grid gap-4">
            {confirmed.map(b => (
              <BookingCard key={b.id} booking={b} />
            ))}
            {confirmed.length === 0 && <p className="text-muted-foreground text-sm">No confirmed bookings.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Arrived / Closed ({arrived.length})</h2>
          <div className="grid gap-4">
            {arrived.map(b => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
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
