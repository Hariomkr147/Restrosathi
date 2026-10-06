import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { processOutbox } from "@/lib/whatsapp/outbox";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return new NextResponse(null, { status: 401 });
  }
  const result = await processOutbox();
  return NextResponse.json(result);
}
