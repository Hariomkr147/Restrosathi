import { prisma } from "../db";
import { formatINR } from "../money/format";
import { getProvider } from "../ai";
import { getSettings } from "../settings";
import { consumeMonthlyQuota } from "../ai/usage";

export function getPreviousWeekWindowIST(now: Date = new Date()) {
  // Convert now to IST
  const tzOffset = 5.5 * 60 * 60 * 1000;
  // Get time in IST relative to UTC
  // Wait, to do it robustly:
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istNow = new Date(istString);
  
  // A week goes from Monday to Sunday.
  // We want the *previous* week.
  // If we are currently on Monday, is it the previous week or 2 weeks ago?
  // "Monday after 09:00 and no existing week log" -> report is generated on Monday.
  // So the "previous week" is the Monday-Sunday right before this Monday.
  
  // day of week: 0=Sun, 1=Mon, ..., 6=Sat
  const day = istNow.getDay();
  // We want to find the Sunday of the previous week.
  // If today is Monday (1), previous Sunday is yesterday.
  // If today is Sunday (0), previous Sunday is 7 days ago.
  const daysToPrevSunday = day === 0 ? 7 : day;
  
  const prevSunday = new Date(istNow);
  prevSunday.setDate(istNow.getDate() - daysToPrevSunday);
  
  // The Monday before that Sunday is 6 days prior to prevSunday
  const prevMonday = new Date(prevSunday);
  prevMonday.setDate(prevSunday.getDate() - 6);
  
  // Create boundaries in IST
  const startIST = new Date(prevMonday.getFullYear(), prevMonday.getMonth(), prevMonday.getDate(), 0, 0, 0, 0);
  const endIST = new Date(prevSunday.getFullYear(), prevSunday.getMonth(), prevSunday.getDate(), 23, 59, 59, 999);
  
  // Convert back to UTC for Prisma queries
  // Since we created startIST locally (which uses server local time), we need a better way.
  
  // Let's use string manipulation to be exact.
  const toYYYYMMDD = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  
  const startStr = `${toYYYYMMDD(prevMonday)}T00:00:00.000+05:30`;
  const endStr = `${toYYYYMMDD(prevSunday)}T23:59:59.999+05:30`;
  
  return {
    startAt: new Date(startStr),
    endAt: new Date(endStr),
    weekStart: new Date(`${toYYYYMMDD(prevMonday)}T00:00:00.000Z`) // The ID for the WeeklyReportLog (Date only)
  };
}

export async function generateWeeklyReport(now: Date = new Date(), options: { saveLog?: boolean } = { saveLog: true }) {
  const { startAt, endAt, weekStart } = getPreviousWeekWindowIST(now);
  
  return await prisma.$transaction(async (tx) => {
    if (options.saveLog) {
      try {
        await tx.weeklyReportLog.create({
          data: {
            weekStart: weekStart,
            content: { status: "computing" }
          }
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          return null; // Return null if already generated
        }
        throw e;
      }
    }

    
    // 2. Compute facts
    const bills = await tx.bill.findMany({
      where: {
        generatedAt: { gte: startAt, lte: endAt },
        status: { in: ["SETTLED", "OPEN"] }
      },
      include: {
        lines: true
      }
    });
    
    const cancelledBills = await tx.bill.count({
      where: {
        generatedAt: { gte: startAt, lte: endAt },
        status: "CANCELLED"
      }
    });
    
    const revenuePaise = bills.reduce((sum, b) => sum + b.totalPaise, 0);
    const orderCount = bills.length;
    const avgOrderValuePaise = orderCount > 0 ? Math.round(revenuePaise / orderCount) : 0;
    
    // Day and Hour stats
    const salesByDay: Record<number, number> = {};
    const salesByHour: Record<number, number> = {};
    
    for (const b of bills) {
      const bIst = new Date(b.generatedAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const day = bIst.getDay();
      const hour = bIst.getHours();
      salesByDay[day] = (salesByDay[day] || 0) + b.totalPaise;
      salesByHour[hour] = (salesByHour[hour] || 0) + b.totalPaise;
    }
    
    const bestDay = Object.keys(salesByDay).length > 0 ? parseInt(Object.keys(salesByDay).reduce((a, b) => salesByDay[parseInt(a)] > salesByDay[parseInt(b)] ? a : b)) : -1;
    const bestHour = Object.keys(salesByHour).length > 0 ? parseInt(Object.keys(salesByHour).reduce((a, b) => salesByHour[parseInt(a)] > salesByHour[parseInt(b)] ? a : b)) : -1;
    
    // Top dishes
    const itemsQty: Record<string, number> = {};
    const itemNames: Record<string, string> = {};
    for (const b of bills) {
      for (const line of b.lines) {
        // we can use item name
        const n = typeof line.name === "string" ? line.name : (line.name as any).en || "Unknown";
        itemsQty[n] = (itemsQty[n] || 0) + line.qty;
      }
    }
    
    const topDishes = Object.entries(itemsQty)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);
      
    // Bookings
    const confirmedBookings = await tx.booking.count({
      where: {
        slotStart: { gte: startAt, lte: endAt },
        status: "ARRIVED" // confirmed or arrived? 
      }
    });
    const noShowBookings = await tx.booking.count({
      where: {
        slotStart: { gte: startAt, lte: endAt },
        status: "NO_SHOW"
      }
    });
    
    // Feedback
    const feedbacks = await tx.feedback.findMany({
      where: {
        submittedAt: { gte: startAt, lte: endAt }
      }
    });
    
    const ratingCount = feedbacks.filter(f => f.rating != null).length;
    const ratingSum = feedbacks.filter(f => f.rating != null).reduce((sum, f) => sum + f.rating!, 0);
    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
    
    // Voided lines
    const voidedLines = await tx.orderLine.count({
      where: {
        voidedAt: { gte: startAt, lte: endAt }
      }
    });
    
    // 3. AI Insight
    let insight = "";
    try {
      const allowed = await consumeMonthlyQuota();
      if (allowed) {
        const prompt = `Write a short insight (under 200 chars) for this week's restaurant performance. No URLs, no promises.
Revenue: ${formatINR(revenuePaise)}
Orders: ${orderCount}
Avg Order: ${formatINR(avgOrderValuePaise)}
Best day: ${bestDay} (0=Sun)
Best hour: ${bestHour}
Top dishes: ${topDishes.join(", ")}
Rating: ${avgRating.toFixed(1)}/5 (${ratingCount} reviews)
Bookings: ${confirmedBookings} confirmed, ${noShowBookings} no-shows
Voidal: ${voidedLines} items voided, ${cancelledBills} bills cancelled.`;

        const ai = getProvider();
        const res = await ai.complete({
          system: "You are an AI analyst.",
          user: prompt
        });
        insight = res.text.trim().substring(0, 200);
      }
    } catch (err) {
      console.error("AI Insight failed", err);
    }
    
    const content = {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      revenuePaise,
      orderCount,
      avgOrderValuePaise,
      bestDay,
      bestHour,
      topDishes,
      confirmedBookings,
      noShowBookings,
      avgRating,
      ratingCount,
      voidedLines,
      cancelledBills,
      insight
    };
    
    if (options.saveLog) {
      const log = await tx.weeklyReportLog.update({
        where: { weekStart },
        data: { content }
      });
      return log;
    }
    
    return { weekStart, content };
  });
}
