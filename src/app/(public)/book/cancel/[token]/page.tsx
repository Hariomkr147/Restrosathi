import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { cancelByToken } from "@/lib/bookings/cancel";
import { revalidatePath } from "next/cache";

export default async function CancelBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
  
  if (!booking) {
    notFound();
  }

  async function handleCancel() {
    "use server";
    await cancelByToken(token);
    revalidatePath(`/book/cancel/${token}`);
  }

  return (
    <main className="mx-auto w-full max-w-content px-6 py-12 text-center">
      <h1 className="text-3xl font-bold tracking-tight mb-4 text-foreground">Cancel Booking</h1>
      
      {booking.status === "CANCELLED" || booking.status === "DECLINED" ? (
        <div className="bg-muted p-6 rounded-lg max-w-md mx-auto border">
          <p className="text-lg">This booking has been cancelled.</p>
        </div>
      ) : booking.slotStart < new Date() ? (
        <div className="bg-muted p-6 rounded-lg max-w-md mx-auto border">
          <p className="text-lg">This booking is in the past and cannot be cancelled.</p>
        </div>
      ) : (
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border max-w-md mx-auto">
          <p className="mb-4">
            Are you sure you want to cancel your booking for <br/>
            <strong>{booking.name}</strong> on <br/>
            <strong>
              {booking.slotStart.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
            </strong>?
          </p>
          <form action={handleCancel}>
            <button
              type="submit"
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-touch rounded-md px-4 font-medium"
            >
              Yes, cancel it
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
