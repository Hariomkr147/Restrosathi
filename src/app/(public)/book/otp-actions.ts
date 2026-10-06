"use server";

import { requestOtp, verifyOtp } from "@/lib/otp";
import { headers } from "next/headers";

async function getIp(): Promise<string> {
  // In Next.js, headers() is a read-only list
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1";
}

export async function requestOtpAction(phone: string) {
  const ip = await getIp();
  return requestOtp(phone, { ip });
}

export async function verifyOtpAction(phone: string, code: string) {
  return verifyOtp(phone, code, {});
}
