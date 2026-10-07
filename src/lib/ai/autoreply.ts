/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from "../db";
import { buildFacts } from "./facts";
import { isAllergyQuestion } from "./allergy";
import { consumeMonthlyQuota } from "./usage";
import { getProvider } from "./index";
import { notify } from "../whatsapp/notify";

export async function handleIncoming(messageId: string): Promise<void> {
  const AI_AUTOREPLY_DAILY_LIMIT = parseInt(process.env.AI_AUTOREPLY_DAILY_LIMIT || "10", 10);
  const msg = await prisma.messageLog.findUnique({
    where: { externalId: messageId }
  });
  if (!msg || msg.direction !== "IN" || msg.aiHandled) return;

  const phone = msg.phone;
  const text = msg.body?.trim() || "";

  // Check thread state paused
  const thread = await prisma.threadState.findUnique({ where: { phone } });
  if (thread?.aiPausedUntil && thread.aiPausedUntil > new Date()) {
    return;
  }

  // Check opt-out
  const optOut = await prisma.optOut.findUnique({ where: { phone } });
  if (optOut) return;

  // STOP is already handled in inbound.ts
  if (text.toUpperCase() === "STOP") return;

  // Check daily limit for this phone
  // The plan asks for a daily limit count. We can count the IN messages for today that are aiHandled
  // Or just count all OUT messages with kind="AUTO_REPLY" for this phone today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const replyCount = await prisma.messageLog.count({
    where: {
      phone,
      direction: "OUT",
      kind: "AUTO_REPLY",
      createdAt: { gte: today }
    }
  });

  if (replyCount >= AI_AUTOREPLY_DAILY_LIMIT) {
    await prisma.messageLog.update({
      where: { id: msg.id },
      data: { needsHuman: true }
    });
    return;
  }

  // Allergy check
  if (isAllergyQuestion(text)) {
    await notify("AUTO_REPLY", phone, { text: "Please ask our staff about allergies." });
    await prisma.messageLog.update({
      where: { id: msg.id },
      data: { aiHandled: true, needsHuman: true }
    });
    return;
  }

  // Check monthly quota
  const canProceed = await consumeMonthlyQuota();
  if (!canProceed) {
    await triggerHandover(msg.id, phone);
    return;
  }

  // Provider call
  const facts = await buildFacts();
  const APP_URL = process.env.APP_URL || "http://localhost:3000";
  const bookUrl = `${APP_URL}/book`;
  const eventsUrl = `${APP_URL}/events`;

  // We fetch last 10 messages for context
  const recentMsgs = await prisma.messageLog.findMany({
    where: { phone },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const history = recentMsgs.reverse().map(m => `${m.direction === "IN" ? "Customer" : "Bot"}: ${m.body || m.kind}`).join("\n");

  const systemPrompt = `You are a helpful restaurant assistant.
You can ONLY use the following facts to answer questions.
Do NOT invent any prices, menu items, or discounts.
Do NOT confirm any bookings or say anything is "pakka" or "confirmed".
Respond ONLY with a JSON object containing { "reply": "...", "needsHuman": boolean }.
Keep reply under 600 characters.

Facts:
${facts}

Recent History:
${history}`;

  try {
    const provider = getProvider();
    const result = await provider.complete({
      system: systemPrompt,
      user: text
    });

    const parsed = JSON.parse(result.text) as { reply: string; needsHuman: boolean };
    const reply = parsed.reply;
    
    if (typeof reply !== "string" || reply.length > 600) {
      throw new Error("Invalid reply format or length");
    }

    // Validate prices: any rupee amount (rs, ₹) in the reply must exist in the facts
    const priceMatches = reply.match(/(?:rs\.?|₹)\s*\d+(?:,\d{3})*(?:\.\d{2})?/gi);
    if (priceMatches) {
      for (const p of priceMatches) {
        const amt = p.replace(/[^\d.]/g, "");
        if (!facts.includes(amt)) {
          throw new Error("Invented price");
        }
      }
    }

    // No confirmation language
    const confirmationWords = ["confirmed", "pakka", "booked", "guaranteed"];
    if (confirmationWords.some(w => reply.toLowerCase().includes(w))) {
      throw new Error("Confirmation language detected");
    }

    // No urls except bookUrl and eventsUrl
    const urlMatches = reply.match(/https?:\/\/[^\s]+/gi);
    if (urlMatches) {
      for (const u of urlMatches) {
        if (!u.startsWith(bookUrl) && !u.startsWith(eventsUrl)) {
          throw new Error("Invalid URL");
        }
      }
    }

    if (parsed.needsHuman) {
      await triggerHandover(msg.id, phone);
      return;
    }

    await notify("AUTO_REPLY", phone, { text: reply });
    await prisma.messageLog.update({
      where: { id: msg.id },
      data: { aiHandled: true }
    });

  } catch (err) {
    await triggerHandover(msg.id, phone);
  }
}

async function triggerHandover(messageId: string, phone: string) {
  await notify("AUTO_REPLY", phone, { text: "Thanks! Our staff will reply shortly." });
  await prisma.messageLog.update({
    where: { id: messageId },
    data: { needsHuman: true, aiHandled: true }
  });
}
