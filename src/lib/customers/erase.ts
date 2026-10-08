import { prisma as db } from "../db";
import { audit } from "@/lib/audit";
import { randomBytes } from "crypto";

export const HANDLED_MODELS = [
  "ConsentRecord",
  "Customer",
  "ThreadState",
  "OtpCode",
  "MessageLog",
  "Booking",
  "EventEnquiry",
  "DiningSession",
  "Order",
  "Bill", // Not all handled entirely, but fields are handled in logic
  "OptOut", // Excluded explicitly to be kept
  "Feedback",
  "LoyaltyTxn"
];

export async function eraseCustomer(customerId: string, actor: { id: string; role: string }) {
  if (actor.role !== "OWNER") {
    throw new Error("Only OWNER can erase a customer");
  }

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;

  const phone = customer.phone;
  const deletedPhone = `+00deleted${randomBytes(4).toString("hex")}`;

  await db.$transaction(async (tx) => {
    // 1. Delete ConsentRecords, Feedback, LoyaltyTxn
    await tx.consentRecord.deleteMany({ where: { customerId } });
    await tx.feedback.deleteMany({ where: { customerId } });
    if ("loyaltyTxn" in tx) {
      await (tx.loyaltyTxn as { deleteMany: (args: any) => Promise<any> }).deleteMany({ where: { customerId } });
    }
    
    // 2. Delete Customer
    await tx.customer.delete({ where: { id: customerId } });

    // 3. Delete ThreadState
    await tx.threadState.deleteMany({ where: { phone } });

    // 4. Delete OtpCode
    await tx.otpCode.deleteMany({ where: { phone } });

    // 5. Anonymize Booking
    await tx.booking.updateMany({
      where: { phone },
      data: { name: "Deleted", phone: deletedPhone },
    });

    // 6. Anonymize EventEnquiry
    await tx.eventEnquiry.updateMany({
      where: { phone },
      data: { name: "Deleted", phone: deletedPhone },
    });

    // 7. Anonymize DiningSession
    await tx.diningSession.updateMany({
      where: { customerPhone: phone },
      data: { customerName: "Deleted", customerPhone: deletedPhone },
    });

    // 8. Anonymize Order
    const sessions = await tx.diningSession.findMany({ where: { customerPhone: deletedPhone } });
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length > 0) {
      await tx.order.updateMany({
        where: { sessionId: { in: sessionIds } },
        data: { customerName: "Deleted" },
      });
    }

    // 9. Anonymize MessageLog
    await tx.messageLog.updateMany({
      where: { phone },
      data: { phone: deletedPhone, body: "[DELETED]", params: {} },
    });

    // 11. Anonymize Bill
    await tx.bill.updateMany({
      where: { customerPhone: phone },
      data: { customerName: null, customerPhone: null, phoneVerifiedAt: null },
    });

    // We MUST keep OptOut!

    // Audit
    await audit({ actorId: actor.id, action: "customer.erase", entity: "Customer", entityId: customerId }, tx);
  });
}
