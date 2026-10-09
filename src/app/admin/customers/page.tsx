/* eslint-disable @typescript-eslint/no-unused-vars */
import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Customer } from "@prisma/client";

export const metadata = {
  title: "Customers | Admin | RestroSathi"
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePageUser();
  const q = (await searchParams).q || "";

  let where = {};
  if (q) {
    where = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } }
      ]
    };
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      consentRecords: {
        orderBy: { at: "desc" },
        take: 1
      }
    }
  });

  const phones = customers.map(c => c.phone);
  const allBills = await prisma.bill.findMany({
    where: { customerPhone: { in: phones }, status: "SETTLED" },
    select: { customerPhone: true, settledAt: true }
  });

  const billsByPhone = allBills.reduce((acc, bill) => {
    if (bill.customerPhone) {
      if (!acc[bill.customerPhone]) acc[bill.customerPhone] = [];
      acc[bill.customerPhone].push(bill);
    }
    return acc;
  }, {} as Record<string, typeof allBills>);

  const eligibleCount = customers.filter(c => c.consentRecords[0]?.granted).length;

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <form className="flex gap-2 w-full sm:w-auto">
          <input 
            type="search" 
            name="q" 
            defaultValue={q} 
            placeholder="Search name or phone" 
            className="border px-3 py-2 rounded flex-1"
          />
          <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded">Search</button>
        </form>
      </div>

      <div className="bg-card rounded-lg shadow border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Last Visit</th>
              <th className="px-4 py-3 font-medium">Marketing Consent</th>
              {/* <th className="px-4 py-3 font-medium">Points</th> */}
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map(c => {
              const customerBills = billsByPhone[c.phone] || [];
              const visits = customerBills.length;
              let lastVisit = "-";
              if (visits > 0) {
                const dates = customerBills.map(b => b.settledAt?.getTime() || 0).sort((a, b) => b - a);
                lastVisit = new Date(dates[0]).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
              }
              
              const consent = c.consentRecords[0];
              const consentStatus = consent ? (consent.granted ? "Yes" : "No") : "Not asked";

              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name || "-"}</td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.verifiedAt ? "✅" : "-"}</td>
                  <td className="px-4 py-3">{visits}</td>
                  <td className="px-4 py-3">{lastVisit}</td>
                  <td className="px-4 py-3">
                    <span className={consentStatus === "Yes" ? "text-green-600 font-medium" : consentStatus === "No" ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      {consentStatus}
                    </span>
                  </td>
                  {/* <td className="px-4 py-3">-</td> */}
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/customers/${c.id}`} className="text-primary hover:underline font-medium">View</Link>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No customers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
