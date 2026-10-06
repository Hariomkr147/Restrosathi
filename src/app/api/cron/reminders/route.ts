import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendDueReminders } from "@/lib/bookings/reminders";

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/, "");
  const secret = process.env.CRON_SECRET || "";
  
  if (secret && (!token || token.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret)))) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const { count } = await sendDueReminders();
  
  return NextResponse.json({ ok: true, count });
}
