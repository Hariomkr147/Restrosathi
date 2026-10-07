/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import { notify, renderMessage, MessageKind } from "./notify";
import { prisma } from "../db";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";

describe("notify()", () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany();
  });

  it("writes a PENDING row with params and normalises phone", async () => {
    const res = await notify("OTP", "98765 43210", { code: "123456", minutes: 10 });
    expect(res).not.toHaveProperty("skipped");
    if ("id" in res) {
      const row = await prisma.messageLog.findUnique({ where: { id: res.id } });
      expect(row).not.toBeNull();
      expect(row!.phone).toBe("+919876543210");
      expect(row!.status).toBe("PENDING");
      expect(row!.direction).toBe("OUT");
      expect(row!.kind).toBe("OTP");
      expect(row!.params).toEqual({ code: "123456", minutes: 10 });
      expect(row!.locale).toBe("en");
      expect(row!.nextAttemptAt?.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  it("returns skipped for invalid phone", async () => {
    const res = await notify("OTP", "123", { code: "123" });
    expect(res).toEqual({ skipped: "INVALID_PHONE" });
  });

  it("uses the caller's transaction and rolls back correctly", async () => {
    try {
      await prisma.$transaction(async (tx) => {
        await notify("OTP", "9876543210", { code: "123" }, { tx });
        throw new Error("ROLLBACK");
      });
    } catch (e) {}
    const count = await prisma.messageLog.count();
    expect(count).toBe(0);
  });
});

describe("renderMessage()", () => {
  it("renders templates in both languages without leftover placeholders", () => {
    const testCases: { kind: MessageKind; params: any }[] = [
      { kind: "OTP", params: { code: "123456", minutes: 10 } },
      { kind: "BOOKING_RECEIVED", params: { date: "Today", time: "19:00", pax: 4 } },
      { kind: "BOOKING_CONFIRMED", params: { date: "Today", time: "19:00", pax: 4 } },
      { kind: "BOOKING_DECLINED", params: {} },
      { kind: "BOOKING_REMINDER", params: { time: "19:00" } },
      { kind: "EVENT_ENQUIRY_RECEIVED", params: {} },
      { kind: "ORDER_ESCALATION", params: { label: "Table 4" } },
      { kind: "THANK_YOU_FEEDBACK", params: { link: "http://example.com" } },
      { kind: "WEEKLY_REPORT", params: { sales: "₹10,000", orderCount: 42 } },
      { kind: "STOP_CONFIRMED", params: {} },
      { kind: "AUTO_REPLY", params: { answer: "We are open until 11 PM." } },
    ];

    for (const { kind, params } of testCases) {
      // Check EN
      const enText = renderMessage(kind, params, "en");
      expect(enText.length).toBeGreaterThan(0);
      expect(enText).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      
      // Check HI
      const hiText = renderMessage(kind, params, "hi");
      expect(hiText.length).toBeGreaterThan(0);
      expect(hiText).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
    }
  });

  it("throws on unknown param in template", () => {
    // If a template expects {missing} but it's not provided, it should throw or we test it by checking leftovers.
    // The spec says: "unknown params are an error in tests (every template is covered by a render test that fills all its placeholders)".
    expect(() => renderMessage("OTP", { code: "123" }, "en")).toThrow();
  });
});
