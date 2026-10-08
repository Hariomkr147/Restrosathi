import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatINR } from "@/lib/money/format";
import { EraseCustomerButton } from "./EraseCustomerButton";
import { EditConsentForm } from "./EditConsentForm";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      consentRecords: {
        orderBy: { at: "desc" }
      }
    }
  });

  if (!customer) notFound();

  const bills = await prisma.bill.findMany({
    where: { customerPhone: customer.phone },
    orderBy: { generatedAt: "desc" },
    take: 50,
    include: { session: { include: { table: true } } }
  });

  const bookings = await prisma.booking.findMany({
    where: { phone: customer.phone },
    orderBy: { slotStart: "desc" },
    take: 50
  });

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="flex items-center gap-4 border-b pb-4">
        <Link href="/admin/customers" className="text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="text-2xl font-bold">{customer.name || customer.phone}</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-4">
            <h2 className="font-semibold text-lg mb-4">Customer Details</h2>
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Phone:</span> {customer.phone} {customer.verifiedAt && "✅"}</p>
              <p><span className="text-muted-foreground">Name:</span> {customer.name || "-"}</p>
              <p><span className="text-muted-foreground">Birthday:</span> {customer.birthday ? customer.birthday.toLocaleDateString("en-IN") : "-"}</p>
              <p><span className="text-muted-foreground">Anniversary:</span> {customer.anniversary ? customer.anniversary.toLocaleDateString("en-IN") : "-"}</p>
              <p><span className="text-muted-foreground">Added:</span> {customer.createdAt.toLocaleDateString("en-IN")}</p>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <h2 className="font-semibold text-lg mb-4">Marketing Consent</h2>
            {user.role === "OWNER" ? (
              <EditConsentForm 
                customerId={customer.id} 
                current={customer.consentRecords[0]?.granted} 
              />
            ) : (
              <p className="text-sm font-medium">
                {customer.consentRecords[0] ? (customer.consentRecords[0].granted ? "Granted" : "Revoked/Denied") : "Not asked"}
              </p>
            )}

            {customer.consentRecords.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">History</h3>
                {customer.consentRecords.map(cr => (
                  <div key={cr.id} className="text-xs space-y-1">
                    <p className="font-medium">
                      {cr.purpose}: {cr.granted ? "✅ Granted" : "❌ Denied"}
                    </p>
                    <p className="text-muted-foreground">Via {cr.source} on {cr.at.toLocaleString("en-IN")}</p>
                    {cr.textVersion && <p className="text-muted-foreground italic text-[10px]">v: {cr.textVersion}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {user.role === "OWNER" && (
            <div className="bg-red-50 text-red-900 border border-red-200 rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-lg">Danger Zone</h2>
              <p className="text-sm opacity-80">Erase this customer&apos;s personal data. This cannot be undone.</p>
              <EraseCustomerButton customerId={customer.id} />
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-8">
          <div>
            <h2 className="text-xl font-bold mb-4">Recent Visits</h2>
            {bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits recorded.</p>
            ) : (
              <div className="bg-card border rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Table/Type</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bills.map(b => (
                      <tr key={b.id}>
                        <td className="px-4 py-2">{b.generatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                        <td className="px-4 py-2">{b.session.kind === "DINE_IN" ? b.session.table?.label : "Takeaway"}</td>
                        <td className="px-4 py-2">{b.status}</td>
                        <td className="px-4 py-2 text-right">{formatINR(b.totalPaise)}</td>
                        <td className="px-4 py-2 text-right"><Link href={`/admin/bills/view/${b.id}`} className="text-primary hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Bookings</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings.</p>
            ) : (
              <div className="bg-card border rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 font-medium">For Date</th>
                      <th className="px-4 py-2 font-medium">Pax</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Received At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bookings.map(b => (
                      <tr key={b.id}>
                        <td className="px-4 py-2">{b.slotStart.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                        <td className="px-4 py-2">{b.partySize}</td>
                        <td className="px-4 py-2">{b.status}</td>
                        <td className="px-4 py-2">{b.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
