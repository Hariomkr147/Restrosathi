import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require";
import Link from "next/link";
import { formatINR } from "@/lib/money/format";

export const metadata = { title: "Marketing Campaigns" };

export default async function MarketingIndex() {
  const user = await requireUser();
  if (user.role !== "OWNER") return <p>Unauthorized</p>;

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { sends: true }
      }
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Marketing Campaigns</h1>
        <Link href="/admin/marketing/new" className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
          New Campaign
        </Link>
      </div>

      <div className="space-y-4">
        {campaigns.map(c => (
          <Link key={c.id} href={`/admin/marketing/${c.id}`} className="block p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-bold text-lg">{c.goal}</h2>
              <span className={`px-2 py-1 text-xs font-bold rounded ${c.status === "SENT" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                {c.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Segment: <span className="font-medium">{c.segment}</span></p>
              <p>Recipients: {c._count.sends}</p>
              <p>Created: {c.createdAt.toLocaleDateString()}</p>
            </div>
          </Link>
        ))}
        {campaigns.length === 0 && <p className="text-gray-500">No campaigns found.</p>}
      </div>
    </div>
  );
}
