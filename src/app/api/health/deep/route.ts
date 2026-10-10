import { verifyCronSecret } from "@/lib/cron";
 
import { NextResponse } from "next/server";
import { runChecks } from "@/lib/monitoring/checks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const results = await runChecks(new Date());
    const isOk = results.every(r => r.ok);
    return NextResponse.json({
      ok: isOk,
      checks: results,
      version: process.env.npm_package_version || "unknown"
    }, { status: isOk ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
