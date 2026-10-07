/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { submitEnquiry } from "@/lib/events/enquiries";
import { headers } from "next/headers";

export async function submitEnquiryAction(input: any) {
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "127.0.0.1";
  return await submitEnquiry(input, { ip });
}
