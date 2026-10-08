import { prisma } from "../db";
import { rh } from "../billing/money";

export async function getDashboardFacts() {
  const now = new Date();
  
  // IST offset is +05:30
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  const y = parts.find(p => p.type === 'year')!.value;
  
  const todayMidnightIST = new Date(`${y}-${m}-${d}T00:00:00+05:30`);
  const tomorrowMidnightIST = new Date(todayMidnightIST.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(todayMidnightIST.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(todayMidnightIST.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(todayMidnightIST.getTime() - 29 * 24 * 60 * 60 * 1000);

  // Sales
  const todayBills = await prisma.bill.aggregate({
    _count: { id: true },
    _sum: { totalPaise: true },
    where: { status: "SETTLED", settledAt: { gte: todayMidnightIST } }
  });
  const todayTotal = todayBills._sum.totalPaise || 0;
  const todayCount = todayBills._count.id;
  const todayAverage = todayCount > 0 ? rh(todayTotal, todayCount) : 0;

  // Open sessions
  const openSessions = await prisma.diningSession.count({ where: { status: "OPEN" } });

  // 7-day feedback average
  const feedback30 = await prisma.feedback.aggregate({
    _avg: { rating: true },
    where: { submittedAt: { gte: sevenDaysAgo }, rating: { not: null } }
  });
  const feedbackAvg = feedback30._avg.rating ? feedback30._avg.rating.toFixed(1) : "-";

  // Needs human
  const threads = await prisma.messageLog.groupBy({
    by: ["phone"],
    where: { needsHuman: true }
  });

  // Top dishes today and 7-day
  const todayOrderLines = await prisma.orderLine.groupBy({
    by: ['itemId'],
    _sum: { qty: true },
    where: { 
      itemId: { not: null },
      order: { placedAt: { gte: todayMidnightIST } } 
    },
    orderBy: { _sum: { qty: 'desc' } },
    take: 5
  });
  
  const sevenDayOrderLines = await prisma.orderLine.groupBy({
    by: ['itemId'],
    _sum: { qty: true },
    where: { 
      itemId: { not: null },
      order: { placedAt: { gte: sevenDaysAgo } } 
    },
    orderBy: { _sum: { qty: 'desc' } },
    take: 5
  });

  // Fetch names for top dishes
  const menuItemIds = [...new Set([...todayOrderLines, ...sevenDayOrderLines].map(x => x.itemId as string))];
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true }
  });
  const nameMap = Object.fromEntries(menuItems.map(m => [m.id, typeof m.name === 'object' && m.name !== null && 'en' in m.name ? (m.name as any).en : "Unknown"]));

  const topDishesToday = todayOrderLines.map(x => ({ name: x.itemId ? nameMap[x.itemId] || "Unknown" : "Unknown", qty: x._sum.qty || 0 }));
  const topDishes7Day = sevenDayOrderLines.map(x => ({ name: x.itemId ? nameMap[x.itemId] || "Unknown" : "Unknown", qty: x._sum.qty || 0 }));

  // 24 busy-hour buckets over fourteen days & 30-day sales
  // We'll pull raw bill settledAt and bucket them
  const bills30 = await prisma.bill.findMany({
    where: { status: "SETTLED", settledAt: { gte: thirtyDaysAgo } },
    select: { settledAt: true, totalPaise: true }
  });
  
  const busyHours = Array(24).fill(0);
  const dailySales = Array(30).fill(0);

  for (const b of bills30) {
    if (!b.settledAt) continue;
    const is14 = b.settledAt >= fourteenDaysAgo;
    
    // Get IST hour
    const dateStr = b.settledAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: 'numeric', hour12: false });
    const hour = parseInt(dateStr, 10);
    const bucket = hour === 24 ? 0 : hour;
    if (is14 && bucket >= 0 && bucket <= 23) {
      busyHours[bucket]++;
    }

    // Daily sales bucket
    const diffTime = todayMidnightIST.getTime() - new Date(b.settledAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata", year: 'numeric', month: 'numeric', day: 'numeric'})).getTime();
    const daysAgo = Math.floor(diffTime / (24 * 60 * 60 * 1000));
    // It's possible daysAgo is negative if settledAt is today/future
    if (daysAgo >= 0 && daysAgo < 30) {
      dailySales[29 - daysAgo] += b.totalPaise;
    } else if (daysAgo < 0) {
      dailySales[29] += b.totalPaise; // Put today's in the last bucket
    }
  }

  // Bookings
  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", slotStart: { gte: todayMidnightIST } },
    orderBy: { slotStart: 'asc' }
  });

  const bookingsToday = bookings.filter(b => b.slotStart < tomorrowMidnightIST);
  const bookingsTomorrow = bookings.filter(b => b.slotStart >= tomorrowMidnightIST && b.slotStart < new Date(tomorrowMidnightIST.getTime() + 24 * 60 * 60 * 1000));
  const bookingsNextFive = bookings.filter(b => b.slotStart >= new Date(tomorrowMidnightIST.getTime() + 24 * 60 * 60 * 1000)).slice(0, 5);

  // AI warning
  // Let's just check if AI is enabled and there are recent rate limits or failures
  const aiDisabled = process.env.AI_PROVIDER === "fake";
  
  return {
    todayTotal,
    todayCount,
    todayAverage,
    openSessions,
    feedbackAvg,
    needsHumanCount: threads.length,
    topDishesToday,
    topDishes7Day,
    busyHours,
    dailySales,
    bookingsToday: bookingsToday.length,
    bookingsTomorrow: bookingsTomorrow.length,
    bookingsNextFive: bookingsNextFive.length,
    aiWarning: aiDisabled,
    waState: process.env.WHATSAPP_PROVIDER === "fake" ? "Fake" : "Active"
  };
}
