import { requirePageUser } from "@/lib/auth/session";
import { getBillData } from "@/lib/billing/queries";
import { prisma } from "@/lib/db";
import { getBalance } from "@/lib/loyalty";
import { notFound } from "next/navigation";
import { BillPanel } from "./BillPanel";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function BillDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requirePageUser();
  const { sessionId } = await params;
  const data = await getBillData(sessionId);
  
  if (!data) notFound();
  
  const { session, settings, computed, validLines } = data;
  console.log("BILL PAGE RENDERED, COMPUTED:", computed);
  const label = session.kind === "DINE_IN" ? `Table ${session.table?.label}` : "Takeaway";
  
  const tConsent = await getTranslations("consent.marketing");
  const marketingText = tConsent("text", { restaurant: settings.name });
  
  let customerPointsBalance = null;
  if (session.bill?.customerPhone && session.bill.phoneVerifiedAt) {
    const customer = await prisma.customer.findUnique({ where: { phone: session.bill.customerPhone } });
    if (customer) {
      customerPointsBalance = await getBalance(customer.id);
    }
  }
  
  return (
    <main className="mx-auto w-full max-w-content px-6 py-4">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/bills" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="text-2xl font-bold">{label} Bill</h1>
      </div>
      
      <BillPanel 
        sessionId={session.id} 
        bill={session.bill} 
        lines={validLines} 
        computed={computed} 
        settings={settings}
        userRole={user.role}
        marketingText={marketingText}
        customerPointsBalance={customerPointsBalance}
      />
    </main>
  );
}
