import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { processInboundWebhook } from "@/lib/whatsapp/inbound";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const token = resolvedParams.token;
  const headerToken = req.headers.get("x-webhook-secret");

  const secret = process.env.WA_WEBHOOK_SECRET || "";
  
  let authorized = false;
  
  if (token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    authorized = true;
  } else if (headerToken && headerToken.length === secret.length && crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(secret))) {
    authorized = true;
  }

  if (!authorized) {
    return new NextResponse(null, { status: 401 });
  }

  const lengthStr = req.headers.get("content-length");
  if (lengthStr && parseInt(lengthStr, 10) > 100 * 1024) {
    return new NextResponse(null, { status: 413 });
  }

  let body;
  try {
    const text = await req.text();
    if (text.length > 100 * 1024) return new NextResponse(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // We should return 200 quickly, so we don't await processInboundWebhook if we can avoid it.
  // Wait, Next.js requires waiting for the promise or using executionContext.waitUntil
  // For simplicity and to satisfy the test, we'll await it, but in production we might use waitUntil.
  // We'll await it for now because DB insertion is fast enough.
  try {
    await processInboundWebhook(body);
  } catch (err) {
    console.error("Webhook processing error", err);
    // Even if it fails, return 200 so the gateway does not retry-storm
  }

  return new NextResponse("OK", { status: 200 });
}
