import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { markCampaignSentAction } from "../actions";
import { getMarketingAudience } from "@/lib/marketing/segments";
import { Customer, CampaignSegment } from "@prisma/client";

export const metadata = { title: "Campaign Details" };

export default async function CampaignDetailsPage({ params, searchParams }: { params: { id: string }, searchParams: { page?: string } }) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "STAFF") return <p>Unauthorized</p>;

  const page = parseInt(searchParams.page || "1") || 1;
  const pageSize = 100;

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id }
  });

  if (!campaign) notFound();

  // Recompute audience: if pending send is no longer in audience, delete it
  const audience = await getMarketingAudience(campaign.segment as CampaignSegment);
  const audienceIds = new Set(audience.map((c: Customer) => c.id));
  
  await prisma.campaignSend.deleteMany({
    where: {
      campaignId: campaign.id,
      status: "PENDING",
      customerId: { notIn: Array.from(audienceIds) }
    }
  });

  const campaignWithSends = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      sends: {
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { customerId: "asc" },
        include: { customer: true }
      }
    }
  });

  if (!campaignWithSends) notFound();

  const totalSends = await prisma.campaignSend.count({ where: { campaignId: params.id } });
  const totalPages = Math.ceil(totalSends / pageSize);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h1 className="text-2xl font-bold mb-4">{campaignWithSends.goal}</h1>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
          <p>Segment: <span className="font-medium text-gray-900">{campaignWithSends.segment}</span></p>
          <p>Status: <span className="font-medium text-gray-900">{campaignWithSends.status}</span></p>
          <p>Created: <span className="font-medium text-gray-900">{campaignWithSends.createdAt.toLocaleString()}</span></p>
          <p>Language: <span className="font-medium text-gray-900">{campaignWithSends.locale.toUpperCase()}</span></p>
        </div>
        <div>
          <h2 className="font-bold mb-2">Message</h2>
          <pre className="p-4 bg-gray-50 rounded whitespace-pre-wrap font-sans text-sm border">{campaignWithSends.message}</pre>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Recipients ({totalSends})</h2>
          <div className="flex gap-2">
            {page > 1 && <a href={`?page=${page - 1}`} className="px-3 py-1 border rounded hover:bg-gray-50">Prev</a>}
            {page < totalPages && <a href={`?page=${page + 1}`} className="px-3 py-1 border rounded hover:bg-gray-50">Next</a>}
          </div>
        </div>

        <div className="space-y-4">
          {campaignWithSends.sends.map(s => {
            const name = s.customer.name || "Customer";
            let msg = campaignWithSends.message || "";
            msg = msg.replace(/\{name\}/g, name);
            const text = encodeURIComponent(msg);
            const waUrl = `https://wa.me/${s.phone.replace("+", "")}?text=${text}`;

            return (
              <div key={s.id} className="flex items-center justify-between p-4 border rounded">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-gray-500">{s.phone}</p>
                  {s.status === "SENT" && <p className="text-xs text-green-600 font-bold mt-1">Sent at {s.sentAt?.toLocaleString()}</p>}
                </div>
                
                {s.status !== "SENT" ? (
                  <div className="flex items-center gap-4">
                    <a href={waUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600">
                      Send via WhatsApp
                    </a>
                    <form action={markCampaignSentAction.bind(null, campaign.id, s.id)}>
                      <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-800 rounded text-sm font-medium hover:bg-gray-200">
                        Mark Sent
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded text-sm font-medium">Completed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
