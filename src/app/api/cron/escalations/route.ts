import { escalateStaleOrders } from "@/lib/orders/escalation";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const expected = process.env.CRON_SECRET || "";

  if (token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { escalated } = await escalateStaleOrders();
  return NextResponse.json({ escalated });
}
