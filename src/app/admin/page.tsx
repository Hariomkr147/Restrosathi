import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money/format";

export default async function AdminPage() {
  const user = await requirePageUser();
  const t = await getTranslations("admin");

  if (user.role === "STAFF") {
    return <main className="mx-auto w-full max-w-content px-6 py-8">
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <p className="mt-4">{t("welcome", { name: user.name })}</p>
    </main>;
  }

  // Owner Dashboard
  const now = new Date();
  
  // IST offset is +05:30. To get midnight IST for today:
  // Convert now to IST string, then parse it back as start of day.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  const y = parts.find(p => p.type === 'year')!.value;
  
  // Create IST midnight in UTC
  const todayMidnightIST = new Date(`${y}-${m}-${d}T00:00:00+05:30`);
  const sevenDaysAgo = new Date(todayMidnightIST.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [todayBills, trailingBills, activeSessions, unresolvedThreads] = await Promise.all([
    prisma.bill.aggregate({
      _count: { id: true },
      _sum: { totalPaise: true },
      where: { status: "SETTLED", generatedAt: { gte: todayMidnightIST } }
    }),
    prisma.bill.aggregate({
      _count: { id: true },
      _sum: { totalPaise: true },
      where: { status: "SETTLED", generatedAt: { gte: sevenDaysAgo, lt: todayMidnightIST } }
    }),
    prisma.session.count({
      where: { status: "OPEN" }
    }),
    prisma.messageLog.groupBy({
      by: ["phone"],
      where: { needsHuman: true }
    })
  ]);

  const todayCount = todayBills._count.id;
  const todayTotal = todayBills._sum.totalPaise || 0;

  const trailingCount = trailingBills._count.id;
  const trailingTotal = trailingBills._sum.totalPaise || 0;
  
  const avgBills = trailingCount / 7;
  const avgTotal = trailingTotal / 7;

  return <main className="mx-auto w-full max-w-content px-6 py-8 space-y-8">
    <div>
      <h1 className="font-heading text-3xl">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("welcome", { name: user.name })}</p>
    </div>

    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Today's Sales</h2>
        <div className="text-3xl font-bold mt-2">{formatINR(todayTotal)}</div>
        <div className="text-sm text-muted-foreground mt-1">From {todayCount} bills</div>
      </div>
      
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">7-Day Avg Sales</h2>
        <div className="text-3xl font-bold mt-2">{formatINR(avgTotal)}</div>
        <div className="text-sm text-muted-foreground mt-1">{avgBills.toFixed(1)} bills / day</div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Open Tables</h2>
        <div className="text-3xl font-bold mt-2">{activeSessions}</div>
        <div className="text-sm text-muted-foreground mt-1">Active sessions</div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">WhatsApp Threads</h2>
        <div className={`text-3xl font-bold mt-2 ${unresolvedThreads.length > 0 ? "text-red-600" : ""}`}>
          {unresolvedThreads.length}
        </div>
        <div className="text-sm text-muted-foreground mt-1">Needs human attention</div>
      </div>
    </div>
  </main>;
}
