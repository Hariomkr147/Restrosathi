import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function AdminBlockedDatesPage() {
  const user = await requirePageUser();
  if (user.role !== "OWNER") {
    return <main className="p-6">Owner access required.</main>;
  }

  const blocked = await prisma.blockedDate.findMany({ orderBy: { date: "desc" } });

  async function addBlockedDate(formData: FormData) {
    "use server";
    const date = formData.get("date") as string;
    const reason = formData.get("reason") as string;
    if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      await prisma.blockedDate.upsert({
        where: { date },
        create: { date, reason },
        update: { reason }
      });
      revalidatePath("/admin/bookings/blocked");
    }
  }

  async function removeBlockedDate(formData: FormData) {
    "use server";
    const date = formData.get("date") as string;
    if (date) {
      await prisma.blockedDate.deleteMany({ where: { date } });
      revalidatePath("/admin/bookings/blocked");
    }
  }

  return (
    <main className="admin-chrome mx-auto w-full max-w-content px-6 py-6">
      <div className="mb-6">
        <Link href="/admin/bookings" className="text-muted-foreground text-sm hover:underline mb-2 inline-block">← Back to Bookings</Link>
        <h1 className="text-2xl font-bold">Blocked Dates</h1>
        <p className="text-muted-foreground text-sm">Customers cannot book on blocked dates.</p>
      </div>

      <div className="border rounded-md p-4 bg-card mb-8">
        <form action={addBlockedDate} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Date (YYYY-MM-DD)</label>
            <input type="date" name="date" required className="border rounded px-3 py-2 min-h-touch min-w-[150px] bg-background text-foreground" />
          </div>
          <div className="flex-grow">
            <label className="block text-sm font-medium mb-1">Reason (optional)</label>
            <input type="text" name="reason" placeholder="e.g. Private event" className="border rounded px-3 py-2 min-h-touch w-full bg-background text-foreground" />
          </div>
          <button className="bg-primary text-primary-foreground font-medium px-4 py-2 rounded min-h-touch">Block Date</button>
        </form>
      </div>

      <div className="grid gap-2">
        {blocked.map(b => (
          <div key={b.date} className="flex items-center justify-between border-b pb-2">
            <div>
              <span className="font-medium">{b.date}</span>
              {b.reason && <span className="text-muted-foreground text-sm ml-2">({b.reason})</span>}
            </div>
            <form action={removeBlockedDate}>
              <input type="hidden" name="date" value={b.date} />
              <button className="text-destructive underline text-sm min-h-touch px-2">Remove</button>
            </form>
          </div>
        ))}
        {blocked.length === 0 && <p className="text-muted-foreground">No dates blocked.</p>}
      </div>
    </main>
  );
}
