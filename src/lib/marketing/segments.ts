import { prisma } from "../db";
import { CampaignSegment } from "@prisma/client";

export async function getMarketingAudience(segment: CampaignSegment) {
  // 1. Get all customers who have MARKETING consent granted
  // Since ConsentRecord stores history, we need the latest one per customer.
  // Actually, wait, it's easier to find customers where the latest ConsentRecord is granted.
  // We can just query customers and include their latest ConsentRecord.
  
  const customers = await prisma.customer.findMany({
    include: {
      consentRecords: {
        where: { purpose: "MARKETING" },
        orderBy: { at: "desc" },
        take: 1
      },
      campaignSends: {
        where: { sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 1
      }
    }
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter basic eligibility
  const eligible = customers.filter(c => {
    // Must have granted consent
    if (c.consentRecords.length === 0 || !c.consentRecords[0].granted) return false;
    
    // Must not have received a campaign in the last 7 days
    if (c.campaignSends.length > 0 && c.campaignSends[0].sentAt && c.campaignSends[0].sentAt >= sevenDaysAgo) {
      return false;
    }
    
    return true;
  });

  // Optimize: collect phones for Bill checks
  const eligiblePhones = eligible.map(c => c.phone);

  if (eligiblePhones.length === 0) return [];

  // If segment requires Bill data, we fetch it
  const latestBillByPhone: Record<string, Date> = {};
  if (segment === "VISITED_30_DAYS" || segment === "INACTIVE_60_DAYS") {
    const bills = await prisma.bill.findMany({
      where: {
        customerPhone: { in: eligiblePhones },
        status: { in: ["SETTLED", "OPEN"] } // assume successful visits
      },
      select: {
        customerPhone: true,
        generatedAt: true
      },
      orderBy: { generatedAt: "desc" }
    });

    for (const b of bills) {
      if (b.customerPhone && !latestBillByPhone[b.customerPhone]) {
        latestBillByPhone[b.customerPhone] = b.generatedAt;
      }
    }
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const currentMonth = now.getMonth(); // 0-11

  const finalAudience = eligible.filter(c => {
    if (segment === "ALL") return true;
    
    if (segment === "VISITED_30_DAYS") {
      const lastVisit = latestBillByPhone[c.phone];
      return lastVisit && lastVisit >= thirtyDaysAgo;
    }
    
    if (segment === "INACTIVE_60_DAYS") {
      const lastVisit = latestBillByPhone[c.phone];
      // Must have visited at least once, but not in the last 60 days
      return lastVisit && lastVisit < sixtyDaysAgo;
    }
    
    if (segment === "BIRTHDAYS_THIS_MONTH") {
      return c.birthday && c.birthday.getMonth() === currentMonth;
    }

    return false;
  });

  return finalAudience;
}
