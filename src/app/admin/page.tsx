import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money/format";
import { getDashboardFacts } from "@/lib/dashboard";
import Link from "next/link";

export default async function AdminPage() {
  const user = await requirePageUser();
  const t = await getTranslations("admin");

  if (user.role === "STAFF") {
    // Staff get the planned board shortcuts
    const activeSessions = await prisma.diningSession.count({ where: { status: "OPEN" } });
    
    return <main className="mx-auto w-full max-w-content px-6 py-8 space-y-8">
      <div>
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p className="mt-4">{t("welcome", { name: user.name })}</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/admin/board" className="rounded-lg border bg-card p-6 shadow-sm hover:border-orange-500 transition-colors">
          <h2 className="text-xl font-bold">Kitchen Board</h2>
          <p className="text-muted-foreground mt-2">Manage orders and KOTs</p>
        </Link>
        <Link href="/admin/tables" className="rounded-lg border bg-card p-6 shadow-sm hover:border-orange-500 transition-colors">
          <h2 className="text-xl font-bold">Tables</h2>
          <p className="text-muted-foreground mt-2">{activeSessions} open sessions</p>
        </Link>
      </div>
    </main>;
  }

  // Owner Dashboard
  const facts = await getDashboardFacts();
  const maxSales = Math.max(...facts.dailySales, 100); // Prevent div by zero

  return <main className="mx-auto w-full max-w-content px-6 py-8 space-y-8">
    <div>
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("welcome", { name: user.name })}</p>
    </div>

    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Today&apos;s Sales</h2>
        <div className="text-3xl font-bold mt-2">{formatINR(facts.todayTotal)}</div>
        <div className="text-sm text-muted-foreground mt-1">{facts.todayCount} bills (Avg {formatINR(facts.todayAverage)})</div>
      </div>
      
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">7-Day Feedback Avg</h2>
        <div className="text-3xl font-bold mt-2">{facts.feedbackAvg}</div>
        <div className="text-sm text-muted-foreground mt-1">Out of 5 stars</div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Open Tables</h2>
        <div className="text-3xl font-bold mt-2">{facts.openSessions}</div>
        <div className="text-sm text-muted-foreground mt-1">Active sessions</div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Needs Human Attention</h2>
        <div className={`text-3xl font-bold mt-2 ${facts.needsHumanCount > 0 ? "text-red-600" : ""}`}>
          {facts.needsHumanCount}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {facts.waState === "Fake" && <span className="text-orange-600 font-bold ml-2">WA: FAKE</span>}
          {facts.aiWarning && <span className="text-orange-600 font-bold ml-2">AI: FAKE</span>}
        </div>
      </div>
    </div>
    
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-lg border bg-card p-6 shadow-sm col-span-full">
        <h2 className="text-lg font-bold mb-4">30-Day Sales</h2>
        
        {/* Accessible Table (visually hidden but readable by screen readers) */}
        <table className="sr-only">
          <caption>30-Day Sales Data</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Sales</th>
            </tr>
          </thead>
          <tbody>
            {facts.dailySales.map((s, i) => (
              <tr key={`sr-${i}`}>
                <td>{30 - i} days ago</td>
                <td>{formatINR(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Visual Sparkline */}
        <div className="flex items-end h-32 gap-1" aria-hidden="true">
          {facts.dailySales.map((s, i) => (
            <div 
              key={i}
              title={`Day ${30 - i} ago: ${formatINR(s)}`}
              className="flex-1 bg-orange-200 hover:bg-orange-400 transition-colors rounded-t-sm"
              style={{ height: `${Math.max((s / maxSales) * 100, 2)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Top Dishes (Today)</h2>
        <div className="space-y-3">
          {facts.topDishesToday.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : 
            facts.topDishesToday.map(d => (
              <div key={d.name} className="flex justify-between items-center text-sm">
                <span>{d.name}</span>
                <span className="font-bold">{d.qty}x</span>
              </div>
            ))
          }
        </div>
      </div>
      
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Top Dishes (7 Days)</h2>
        <div className="space-y-3">
          {facts.topDishes7Day.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : 
            facts.topDishes7Day.map(d => (
              <div key={d.name} className="flex justify-between items-center text-sm">
                <span>{d.name}</span>
                <span className="font-bold">{d.qty}x</span>
              </div>
            ))
          }
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Bookings Overview</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-muted-foreground">Today</span>
            <span className="font-bold text-lg">{facts.bookingsToday}</span>
          </div>
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-muted-foreground">Tomorrow</span>
            <span className="font-bold text-lg">{facts.bookingsTomorrow}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Next 5 Days</span>
            <span className="font-bold text-lg">{facts.bookingsNextFive}</span>
          </div>
        </div>
      </div>
    </div>
  </main>;
}
