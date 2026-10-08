"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { getDeviceId } from "@/lib/device";
import { placeOrder } from "@/lib/orders/place";
import { createServiceRequest } from "@/lib/orders/service-requests";
import { verifyOtp, cleanPhone } from "@/lib/otp";
import { prisma } from "@/lib/db";
import { getBalance } from "@/lib/loyalty";
import { isPhoneVerified } from "@/lib/otp/verified-cookie";

// Explicitly public: diners scan a table code without a staff account.
async function requestContext() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return { deviceId: await getDeviceId(), ip: isIP(forwarded) ? forwarded : "unknown" };
}
export async function placeOrderAction(input: unknown) { return placeOrder(input, await requestContext()); }
// Explicitly public: diners request staff help through the table's active code.
export async function serviceRequestAction(code: unknown, kind: unknown) { return createServiceRequest(code, kind, await requestContext()); }

export async function linkPhoneToSessionAction(code: string, rawPhone: string, otp: string) {
  const verifyRes = await verifyOtp(rawPhone, otp, {});
  if (!verifyRes.ok) return verifyRes;
  
  const phone = cleanPhone(rawPhone);
  return prisma.$transaction(async (tx) => {
    const table = await tx.restaurantTable.findFirst({ where: { code, active: true } });
    if (!table) return { ok: false, error: "INVALID_TABLE" };
    
    const session = await tx.diningSession.findFirst({ where: { tableId: table.id, status: { not: "CLOSED" } } });
    if (!session) return { ok: false, error: "SESSION_CLOSED" };
    
    await tx.diningSession.update({
      where: { id: session.id },
      data: { customerPhone: phone, customerPhoneVerifiedAt: new Date() }
    });
    
    return { ok: true };
  });
}

export async function getSessionLoyaltyBalanceAction(customerPhone: string) {
  const phone = cleanPhone(customerPhone);
  if (!(await isPhoneVerified(phone))) return 0;

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) return 0;
  return getBalance(customer.id);
}
