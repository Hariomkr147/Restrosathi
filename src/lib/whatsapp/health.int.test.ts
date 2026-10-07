/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getWhatsAppHealth } from "./health";
import { prisma } from "../db";
import { getWhatsApp } from "./index";

vi.mock("./index", () => ({
  getWhatsApp: vi.fn(),
}));

describe("getWhatsAppHealth()", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns correct status and counts", async () => {
    await prisma.messageLog.create({
      data: { direction: "OUT", phone: "+919876543210", status: "PENDING", kind: "OTP", params: {}, externalId: "1" }
    });
    await prisma.messageLog.create({
      data: { direction: "OUT", phone: "+919876543211", status: "FAILED", kind: "OTP", params: {}, externalId: "2" }
    });
    
    (getWhatsApp as any).mockReturnValue({
      status: async () => "connected"
    });

    const h1 = await getWhatsAppHealth();
    expect(h1).toEqual({ status: "connected", pending: 1, failed: 1 });
  });

  it("caches the result within 30s", async () => {
    vi.advanceTimersByTime(31000); // clear any cache from previous test
    const mockStatus = vi.fn().mockResolvedValue("disconnected");
    (getWhatsApp as any).mockReturnValue({ status: mockStatus });

    await getWhatsAppHealth();
    await getWhatsAppHealth();
    expect(mockStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31000);
    await getWhatsAppHealth();
    expect(mockStatus).toHaveBeenCalledTimes(2);
  });
});
