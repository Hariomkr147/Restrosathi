/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { normalizePhone } from "../phone";
import crypto from "node:crypto";
import enMsgs from "../../../messages/en.json";
import hiMsgs from "../../../messages/hi.json";

export type MessageKind = "OTP" | "BOOKING_RECEIVED" | "BOOKING_CONFIRMED" | "BOOKING_DECLINED" | "BOOKING_CANCELLED" | "BOOKING_REMINDER" | "EVENT_ENQUIRY_RECEIVED" | "ORDER_ESCALATION" | "THANK_YOU_FEEDBACK" | "WEEKLY_REPORT" | "STOP_CONFIRMED" | "AUTO_REPLY";

export type MessagePayloads = {
  OTP: { otp: string; minutes: string | number };
  BOOKING_RECEIVED: { date: string; time: string; pax: string | number };
  BOOKING_CONFIRMED: { date: string; time: string; pax: string | number };
  BOOKING_DECLINED: Record<string, never>;
  BOOKING_CANCELLED: Record<string, never>;
  BOOKING_REMINDER: { time: string };
  EVENT_ENQUIRY_RECEIVED: Record<string, never>;
  ORDER_ESCALATION: { label: string };
  THANK_YOU_FEEDBACK: { name: string; feedbackLink: string };
  WEEKLY_REPORT: { start: string; end: string; orderCount: string | number; sales: string; insight: string };
  STOP_CONFIRMED: Record<string, never>;
  AUTO_REPLY: { answer: string };
};

export async function notify<K extends MessageKind>(
  kind: K, 
  to: string, 
  params: MessagePayloads[K], 
  opts?: { tx?: Prisma.TransactionClient; locale?: "en" | "hi" }
): Promise<{ id: string } | { skipped: "INVALID_PHONE" }> {
  const e164 = normalizePhone(to);
  if (!e164) return { skipped: "INVALID_PHONE" };

  const db = opts?.tx || prisma;

  const row = await db.messageLog.create({
    data: {
      direction: "OUT",
      phone: e164,
      status: "PENDING",
      kind,
      params,
      locale: opts?.locale || "en",
      nextAttemptAt: new Date(),
      externalId: crypto.randomUUID(),
    }
  });

  return { id: row.id };
}

export function renderMessage<K extends MessageKind>(kind: K, params: MessagePayloads[K], locale: "en" | "hi" = "en"): string {
  const msgs = locale === "hi" ? hiMsgs : enMsgs;
  
  let template = (msgs.wa as Record<string, string>)[kind];
  if (!template) {
    // fallback to en if missing in hi (but spec says every key exists in both)
    template = (enMsgs.wa as Record<string, string>)[kind];
  }
  
  if (!template) throw new Error(`Missing template for ${kind}`);

  // Replace {var} with params[var]
  const rendered = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName) => {
    const p = params as Record<string, unknown>;
    if (p[paramName] === undefined) {
      throw new Error(`Missing parameter ${paramName} for template ${kind}`);
    }
    return String(p[paramName]);
  });

  return rendered;
}

import { getWhatsApp } from "./index";

export async function internalSendSystemAlert(phone: string, message: string) {
  const provider = getWhatsApp();
  await provider.sendText(phone, message);
}
