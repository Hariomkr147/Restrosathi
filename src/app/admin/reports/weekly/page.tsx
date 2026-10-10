import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money/format";
import { revalidatePath } from "next/cache";
import { generateWeeklyReport } from "@/lib/reports/weekly";
import { notify } from "@/lib/whatsapp/notify";

export const metadata = { title: "Weekly Reports | Admin" };

export default async function WeeklyReportsPage() {
  const logs = await prisma.weeklyReportLog.findMany({
    orderBy: { weekStart: "desc" }
  });

  async function forceTestSend() {
    "use server";
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.ownerAlertPhone) {
      throw new Error("No owner alert phone configured");
    }

    const log = await generateWeeklyReport(new Date(), { saveLog: false });
    if (!log) throw new Error("Could not generate report");

    type WeeklyReportContent = { startAt: string; endAt: string; revenuePaise: number; orderCount: number; avgOrderValuePaise: number; avgRating: number; ratingCount: number; insight?: string; status?: string };
    const content = log.content as WeeklyReportContent;
    const startAt = new Date(content.startAt);
    const endAt = new Date(content.endAt);

    const toDisplayDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const startStr = toDisplayDate(startAt);
    const endStr = toDisplayDate(endAt);

    const sales = formatINR(content.revenuePaise);
    const locale = settings.ownerReportLocale as "en" | "hi";

    const msgId = await prisma.$transaction(async (tx) => {
      const msgRes = await notify("WEEKLY_REPORT", settings.ownerAlertPhone!, {
        start: startStr,
        end: endStr,
        orderCount: content.orderCount,
        sales,
        insight: content.insight || ""
      }, { tx, locale });
      return "id" in msgRes ? msgRes.id : undefined;
    });

    if (msgId) {
      import("@/lib/whatsapp/outbox").then(({ sendNow }) => sendNow(msgId)).catch(() => {});
    }

    revalidatePath("/admin/reports/weekly");
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Weekly Reports</h1>
        <form action={forceTestSend}>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
            Force Test Send (No Save)
          </button>
        </form>
      </div>

      {logs.length === 0 ? (
        <p className="text-gray-500">No reports generated yet.</p>
      ) : (
        <div className="space-y-6">
          {logs.map(log => {
            const c = log.content as { startAt: string; endAt: string; revenuePaise: number; orderCount: number; avgOrderValuePaise: number; avgRating: number; ratingCount: number; insight?: string; status?: string };
            if (c.status === "computing") {
              return (
                <div key={log.weekStart.toISOString()} className="p-4 bg-gray-100 rounded border border-gray-200">
                  <p className="font-medium">{log.weekStart.toLocaleDateString()}</p>
                  <p className="text-sm text-gray-500">Computing in progress...</p>
                </div>
              );
            }
            return (
              <div key={log.weekStart.toISOString()} className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4">
                  {new Date(c.startAt).toLocaleDateString()} - {new Date(c.endAt).toLocaleDateString()}
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Revenue</p>
                    <p className="font-medium">{formatINR(c.revenuePaise)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Orders</p>
                    <p className="font-medium">{c.orderCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Order</p>
                    <p className="font-medium">{formatINR(c.avgOrderValuePaise)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rating</p>
                    <p className="font-medium">{c.avgRating.toFixed(1)} ({c.ratingCount})</p>
                  </div>
                </div>

                {c.insight && (
                  <div className="mt-4 p-4 bg-blue-50 text-blue-900 rounded italic">
                    &quot;{c.insight}&quot;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
