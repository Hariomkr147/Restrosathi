import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { verifyCronSecret } from "./cron";
import { POST } from "../app/api/cron/outbox/route";
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
  });

  it("POST /api/cron/outbox returns 401 for wrong secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/outbox", {
      method: "POST",
      headers: { "authorization": "Bearer wrong" }
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/cron/outbox returns 200 for correct secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/outbox", {
      method: "POST",
      headers: { "authorization": "Bearer test-cron" }
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("sent");
  });
});
