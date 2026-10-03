"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { getDeviceId } from "@/lib/device";
import { placeOrder } from "@/lib/orders/place";
import { createServiceRequest } from "@/lib/orders/service-requests";

// Explicitly public: diners scan a table code without a staff account.
async function requestContext() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return { deviceId: await getDeviceId(), ip: isIP(forwarded) ? forwarded : "unknown" };
}
export async function placeOrderAction(input: unknown) { return placeOrder(input, await requestContext()); }
// Explicitly public: diners request staff help through the table's active code.
export async function serviceRequestAction(code: unknown, kind: unknown) { return createServiceRequest(code, kind, await requestContext()); }
