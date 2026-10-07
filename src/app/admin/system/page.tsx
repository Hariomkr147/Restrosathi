import { runChecks } from "@/lib/monitoring/checks";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export default async function SystemPage() {
  await requireUser();

  const checks = await runChecks();
  const errors = await prisma.errorLog.findMany({
    orderBy: { at: 'desc' },
    take: 100 // We'll group them to 50 unique digests below
  });

  // Group errors by digest
  const groupedErrors: Record<string, { count: number; latestAt: Date; where: string; message: string }> = {};
  for (const err of errors) {
    if (!groupedErrors[err.digest]) {
      groupedErrors[err.digest] = {
        count: 0,
        latestAt: err.at,
        where: err.where,
        message: err.message
      };
    }
    groupedErrors[err.digest].count++;
  }

  const sortedErrors = Object.values(groupedErrors)
    .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
    .slice(0, 50);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">System Status</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <div 
              key={check.key} 
              className={`p-4 rounded-lg border flex flex-col ${check.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <div className="flex items-center gap-2 font-medium">
                <span className={`w-3 h-3 rounded-full ${check.ok ? "bg-green-500" : "bg-red-500"}`} />
                <span className="capitalize">{check.key}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{check.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Recent Errors</h2>
        {sortedErrors.length === 0 ? (
          <p className="text-gray-500">No recent errors.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2 w-1/4">When</th>
                  <th className="p-2 w-1/4">Where</th>
                  <th className="p-2">Message</th>
                  <th className="p-2 w-16">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedErrors.map((err, i) => (
                  <tr key={i}>
                    <td className="p-2 align-top whitespace-nowrap">
                      {err.latestAt.toLocaleString()}
                    </td>
                    <td className="p-2 align-top font-mono text-xs">{err.where}</td>
                    <td className="p-2 align-top break-words whitespace-pre-wrap">{err.message}</td>
                    <td className="p-2 align-top">{err.count > 1 ? <span className="bg-gray-100 px-2 py-1 rounded">x{err.count}</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
