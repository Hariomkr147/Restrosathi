import { prisma } from "../db";

export type ListBillsFilter = {
  date?: string; // YYYY-MM-DD
  query?: string; // search by invoice number
  status?: "SETTLED" | "CANCELLED";
};

export async function listBills(
  filter: ListBillsFilter,
  actor: { id: string; role: string }
) {
  // Only STAFF and OWNER can list bills
  if (!actor || (actor.role !== "OWNER" && actor.role !== "STAFF")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  // Parse IST date to UTC bounds
  // If date is omitted, default to today in IST
  let yyyy: number, mm: number, dd: number;

  if (filter.date) {
    const parts = filter.date.split("-");
    if (parts.length !== 3) return { ok: false as const, error: "INVALID_DATE" as const };
    yyyy = parseInt(parts[0], 10);
    mm = parseInt(parts[1], 10) - 1;
    dd = parseInt(parts[2], 10);
  } else {
    // Current IST time
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    yyyy = nowIST.getFullYear();
    mm = nowIST.getMonth();
    dd = nowIST.getDate();
  }

  if (isNaN(yyyy) || isNaN(mm) || isNaN(dd)) {
    return { ok: false as const, error: "INVALID_DATE" as const };
  }

  // Create start and end bounds in UTC corresponding to 00:00:00 and 23:59:59 in Asia/Kolkata
  // Asia/Kolkata is UTC+05:30
  // So midnight IST is previous day 18:30:00 UTC
  const startUTC = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
  startUTC.setMinutes(startUTC.getMinutes() - 330);
  
  const endUTC = new Date(Date.UTC(yyyy, mm, dd, 23, 59, 59, 999));
  endUTC.setMinutes(endUTC.getMinutes() - 330);

  const bills = await prisma.bill.findMany({
    where: {
      status: filter.status || { in: ["SETTLED", "CANCELLED"] },
      number: filter.query ? { contains: filter.query } : undefined,
      generatedAt: {
        gte: startUTC,
        lte: endUTC
      }
    },
    include: {
      session: {
        include: {
          table: true
        }
      }
    },
    orderBy: {
      generatedAt: 'desc'
    }
  });

  return { ok: true as const, bills };
}
