import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/db";
import { internalSendSystemAlert } from "@/lib/whatsapp/notify";

vi.mock("@/lib/whatsapp/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whatsapp/notify")>();
  return {
    ...actual,
    internalSendSystemAlert: vi.fn(),
  };
});

describe("Alerts cron", () => {
  beforeEach(async () => {
    process.env.ALLOW_FAKE_WA = "1";
    await prisma.alertState.deleteMany({});
    await prisma.settings.update({
      where: { id: 1 },
      data: { ownerAlertPhone: "1234567890" }
    });
    vi.clearAllMocks();
  });

  it("sends an alert when a check fails", async () => {
    // Cause a failure (no backup)
    await prisma.backupRun.deleteMany({});
    
    const req = new Request("http://localhost/api/cron/alerts", {
      method: "POST",
      headers: {
        "Authorization": "Bearer CRON_SECRET_TEST_KEY"
      }
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.failing).toBeGreaterThan(0);
    
    expect(internalSendSystemAlert).toHaveBeenCalled();
    const [phone, message] = vi.mocked(internalSendSystemAlert).mock.calls[0];
    expect(phone).toBe("1234567890");
    expect(message).toContain("RestroSathi System Alert:");
    expect(message).toContain("backup");
  });
});
