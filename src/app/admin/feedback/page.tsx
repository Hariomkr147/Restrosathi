import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DraftReplyButton } from "./DraftReplyButton";
import { generateFeedbackSummary } from "@/lib/feedback/ai";

export default async function AdminFeedbackPage() {
  await requirePageUser();

  const feedbackRows = await prisma.feedback.findMany({
    where: { submittedAt: { not: null } },
    orderBy: { submittedAt: 'desc' },
    take: 100,
    include: {
      bill: {
        select: {
          customerPhone: true,
          session: {
            select: {
              kind: true,
              table: { select: { label: true } }
            }
          }
        }
      }
    }
  });

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats = await prisma.feedback.groupBy({
    by: ['rating'],
    where: { submittedAt: { gte: last30Days }, rating: { not: null } },
    _count: true
  });

  let sum7 = 0;
  let count7 = 0;
  let sum30 = 0;
  let count30 = 0;

  for (const row of feedbackRows) {
    if (row.rating && row.submittedAt) {
      sum30 += row.rating;
      count30++;
      if (row.submittedAt >= last7Days) {
        sum7 += row.rating;
        count7++;
      }
    }
  }

  const avg7 = count7 > 0 ? (sum7 / count7).toFixed(1) : "-";
  const avg30 = count30 > 0 ? (sum30 / count30).toFixed(1) : "-";

  // Calculate strict weekly window (last Monday to Sunday, or just the last 7 days? The spec says "exact weekly window" - in reporting week it's Mon-Sun. Let's just use last 7 days for the dashboard summary as a rolling 7-day, or compute the window from Monday. R18 mentions Monday owner report. R17 says "Group 7-day 1–3 star feedback vs 4–5 star. Limit input token usage to the exact weekly window.")
  // I will use last7Days to now() as the rolling weekly window.
  const summary = await generateFeedbackSummary(last7Days, now);

  return (
    <main className="mx-auto w-full max-w-content px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Feedback</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">7-Day Average</div>
          <div className="text-3xl font-bold mt-2">{avg7} <span className="text-lg font-normal text-muted-foreground">/ 5</span></div>
          <div className="text-sm text-muted-foreground mt-1">From {count7} ratings</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">30-Day Average</div>
          <div className="text-3xl font-bold mt-2">{avg30} <span className="text-lg font-normal text-muted-foreground">/ 5</span></div>
          <div className="text-sm text-muted-foreground mt-1">From {count30} ratings</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 bg-muted/50 font-semibold border-b flex justify-between items-center">
          <span>7-Day AI Summary</span>
          {!summary && <span className="text-xs font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">Quota Reached / Provider Error / Insufficient Data</span>}
        </div>
        {summary && (
          <div className="p-4 space-y-4 text-sm">
            <div>
              <h3 className="font-bold mb-1 text-green-700">Positive Feedback Areas</h3>
              <ul className="list-disc pl-5 space-y-1">
                {(summary.positive as string[]).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-1 text-red-700">Themes to Improve</h3>
              <ul className="list-disc pl-5 space-y-1">
                {(summary.themes as { theme: string, count: number }[]).map((t, i) => (
                  <li key={i}>{t.theme} <span className="text-muted-foreground text-xs ml-1">({t.count} mentions)</span></li>
                ))}
              </ul>
            </div>
            <div className="bg-muted p-3 rounded">
              <h3 className="font-bold mb-1">Draft Reply (Worst Feedback)</h3>
              <p className="italic text-muted-foreground">{summary.reply}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 bg-muted/50 font-semibold border-b">Latest Feedback</div>
        <div className="divide-y">
          {feedbackRows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No feedback received yet.</div>
          ) : (
            feedbackRows.map(f => (
              <div key={f.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                      {f.rating} ★
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {f.bill.session.kind === "TAKEAWAY" ? "Takeaway" : `Table ${f.bill.session.table?.label}`}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {f.submittedAt?.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "numeric" })}
                  </div>
                </div>
                {f.comment && (
                  <p className="text-sm mt-2 whitespace-pre-wrap">{f.comment}</p>
                )}
                {f.bill.customerPhone && (
                  <DraftReplyButton feedbackId={f.id} phone={f.bill.customerPhone} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
