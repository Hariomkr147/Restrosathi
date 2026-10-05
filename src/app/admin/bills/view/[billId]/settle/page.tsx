import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SettleClient } from "./SettleClient";

export default async function SettlePage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id: billId }
  });

  if (!bill || bill.status !== "OPEN") notFound();

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Settle Bill</h1>
      <SettleClient bill={bill} />
    </div>
  );
}
