 
import { describe, it, expect, beforeEach } from "vitest";
import { verifyCronSecret } from "./cron";
import { POST as OutboxPOST } from "../app/api/cron/outbox/route";
import { POST as AlertsPOST } from "../app/api/cron/alerts/route";
import { POST as EscalationsPOST } from "../app/api/cron/escalations/route";
import { POST as FeedbackThemesPOST } from "../app/api/cron/feedback-themes/route";
import { POST as RemindersPOST } from "../app/api/cron/reminders/route";
import { POST as RetentionPOST } from "../app/api/cron/retention/route";
import { POST as WeeklyReportPOST } from "../app/api/cron/weekly-report/route";
import { NextRequest } from "next/server";

describe("cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron";
    process.env.ALLOW_FAKE_WA = "1";
  });

  it("verifyCronSecret", () => {
    expect(verifyCronSecret("Bearer test-cron")).toBe(true);
    expect(verifyCronSecret("Bearer wrong")).toBe(false);
    expect(verifyCronSecret("Bearer test-cr")).toBe(false);
    expect(verifyCronSecret("test-cron")).toBe(false);
    expect(verifyCronSecret(null)).toBe(false);
    expect(verifyCronSecret("")).toBe(false);
    
    // Unicode checks
    expect(verifyCronSecret("Bearer test-cron🚀")).toBe(false);
    
    process.env.CRON_SECRET = "test-cron🚀";
    expect(verifyCronSecret("Bearer test-cron🚀")).toBe(true);
    expect(verifyCronSecret("Bearer test-cron")).toBe(false);
    expect(verifyCronSecret("Bearer test-cron?")).toBe(false);
  });

  it("rejects unauthorized access to all endpoints", async () => {
    const endpoints = [
      { name: "outbox", handler: OutboxPOST },
      { name: "alerts", handler: AlertsPOST },
      { name: "escalations", handler: EscalationsPOST },
      { name: "feedback-themes", handler: FeedbackThemesPOST },
      { name: "reminders", handler: RemindersPOST },
      { name: "retention", handler: RetentionPOST },
      { name: "weekly-report", handler: WeeklyReportPOST },
    ];

    for (const ep of endpoints) {
      const cases = [
        { label: "missing", header: null },
        { label: "wrong", header: "Bearer wrong" },
        { label: "unicode-tampered", header: "Bearer test-cron🚀" },
        { label: "no-bearer", header: "test-cron" },
      ];

      for (const c of cases) {
        const req = { headers: { get: (name: string) => name === "authorization" ? c.header : null } } as unknown as NextRequest;

        const res = await ep.handler(req);
        expect(res.status).toBe(401);
      }
    }
  });

  it("POST /api/cron/outbox returns 200 for correct secret", async () => {
    process.env.CRON_SECRET = "test-cron";
    const req = new NextRequest("http://localhost/api/cron/outbox", {
      method: "POST",
      headers: { "authorization": "Bearer test-cron" }
    });
    const res = await OutboxPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("sent");
  });
});
