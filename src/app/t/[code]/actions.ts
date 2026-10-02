"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { getDeviceId } from "@/lib/device";
import { placeOrder } from "@/lib/orders/place";

// Explicitly public: diners scan a table code without a staff account.
export async function placeOrderAction(input: unknown) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return placeOrder(input, { deviceId: await getDeviceId(), ip: isIP(forwarded) ? forwarded : "unknown" });
}
