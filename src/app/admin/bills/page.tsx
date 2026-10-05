import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatINR } from "@/lib/money/format";

export default async function BillsPage() {
  await requirePageUser();

  const sessions = await prisma.diningSession.findMany({
    where: { status: "OPEN" },
    include: {
      table: true,
      orders: {
        where: { status: { not: "REJECTED" } },
        include: { lines: { where: { voidedAt: null } } }
      },
      bill: true,
      requests: { where: { resolvedAt: null, kind: "REQUEST_BILL" } }
    },
    orderBy: { openedAt: "desc" }
  });

  return (
    <main className="mx-auto w-full max-w-content px-6 py-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bills</h1>
        <Link 
          href="/admin/bills/history"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          View History
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground">No open sessions.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map(s => {
            const label = s.kind === "DINE_IN" ? `Table ${s.table?.label}` : "Takeaway";
            const amountSoFar = s.orders.flatMap(o => o.lines).reduce((acc, l) => acc + (l.qty * l.unitPricePaise), 0);
            const billRequested = s.requests.length > 0;
            const billReady = s.bill !== null && s.bill.status === "OPEN";
            
            let statusBadge = "Open";
            if (billReady) statusBadge = "Bill ready";
            else if (billRequested) statusBadge = "Bill requested";
            
            return (
              <Link key={s.id} href={`/admin/bills/${s.id}`} className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">{label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${billReady ? 'bg-green-100 text-green-800' : billRequested ? 'bg-yellow-100 text-yellow-800' : 'bg-secondary text-secondary-foreground'}`}>
                    {statusBadge}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Opened: {new Date(s.openedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium text-foreground">{formatINR(amountSoFar)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
