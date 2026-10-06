import { NextResponse } from "next/server";
import { runRetention } from "@/lib/retention";
import crypto from "crypto";

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const expectedToken = process.env.CRON_SECRET || "";
  if (!authHeader || !authHeader.startsWith("Bearer ") || !expectedToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const token = authHeader.substring(7);
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  } catch {
    ok = false;
  }

  if (!ok) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const counts = await runRetention();
  return NextResponse.json({ ok: true, counts });
}
