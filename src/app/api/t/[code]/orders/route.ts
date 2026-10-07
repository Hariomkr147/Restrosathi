import { NextRequest, NextResponse } from "next/server";
import { readJsonWithCap } from "@/lib/http";
import { placeOrder } from "@/lib/orders/place";
import { isIP } from "node:net";
import { getDeviceId } from "@/lib/device";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const originUrl = new URL(origin);
    const expectedProtocol = req.headers.get("x-forwarded-proto") 
      ? `${req.headers.get("x-forwarded-proto")}:` 
      : req.nextUrl.protocol;

    if (originUrl.host !== host || originUrl.protocol !== expectedProtocol) {
      return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  let input;
  try {
    input = await readJsonWithCap(req, 102400); // 100 KB cap
  } catch (err: any) {
    if (err.message === "Payload too large") {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = isIP(forwarded) ? forwarded : "unknown";
  const deviceId = await getDeviceId();

  const res = await placeOrder(input, { ip, deviceId });
  return NextResponse.json(res);
}
