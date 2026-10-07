import { NextRequest, NextResponse } from "next/server";
import { placeOrder } from "@/lib/orders/place";
import { isIP } from "node:net";
import { getDeviceId } from "@/lib/device";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || (host && !origin.includes(host))) {
    return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  let input;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = isIP(forwarded) ? forwarded : "unknown";
  const deviceId = await getDeviceId();

  const res = await placeOrder(input, { ip, deviceId });
  return NextResponse.json(res);
}
