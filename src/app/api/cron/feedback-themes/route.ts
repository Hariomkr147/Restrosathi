import { verifyCronSecret } from "@/lib/cron";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateFeedbackSummary } from "@/lib/feedback/ai";

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const summary = await generateFeedbackSummary(sevenDaysAgo, now);

  if (!summary) {
    return NextResponse.json({ message: "Summary could not be generated." });
  }

  return NextResponse.json({ themes: summary.themes });
}
