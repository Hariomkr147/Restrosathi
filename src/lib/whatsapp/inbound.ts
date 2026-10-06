import { prisma } from "../db";
import crypto from "node:crypto";
import { normalizePhone } from "../phone";

export async function processInboundWebhook(body: any) {
  const { event, data } = body;
  
  if (!data || !data.key) return;

  const remoteJid = data.key.remoteJid || data.from || "";
  const isGroup = data.isGroup || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast");
  
  if (isGroup) {
    return; // Ignore groups and broadcasts without storing
  }

  const phoneStr = remoteJid.split("@")[0];
  const e164 = normalizePhone(phoneStr) || `+${phoneStr}`; // fallback if unparseable

  const messageId = data.key.id || crypto.createHash("sha256").update(`${remoteJid}-${body.timestamp}-${JSON.stringify(data.content)}`).digest("hex");
  const isFromMe = data.key.fromMe || event === "message.sent";
  
  // Dedupe logic via Prisma unique constraint on externalId
  // If we already have it, we just return.
  const existing = await prisma.messageLog.findUnique({
    where: { externalId: messageId }
  });
  if (existing) return;

  if (isFromMe) {
    // Human reply: set ThreadState.aiPausedUntil = now + 12 h
    const pausedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await prisma.threadState.upsert({
      where: { phone: e164 },
      create: { phone: e164, aiPausedUntil: pausedUntil },
      update: { aiPausedUntil: pausedUntil }
    });
    return;
  }

  let text = "";
  if (typeof data.content === "string") text = data.content;
  else if (data.content?.text) text = data.content.text;
  else if (data.content?.conversation) text = data.content.conversation;
  else if (data.message?.conversation) text = data.message.conversation;
  else if (data.message?.extendedTextMessage?.text) text = data.message.extendedTextMessage.text;

  const normalizedText = text.trim().toUpperCase();
  if (normalizedText === "STOP") {
    // Opt-out logic
    await prisma.optOut.upsert({
      where: { phone: e164 },
      create: { phone: e164 },
      update: {}
    });

    // Queue STOP_CONFIRMED message log directly
    await prisma.messageLog.create({
      data: {
        direction: "OUT",
        phone: e164,
        kind: "STOP_CONFIRMED",
        status: "PENDING",
        externalId: crypto.randomUUID(),
        params: {}
      }
    });
    return;
  }

  // Normal IN message
  const msg = await prisma.messageLog.create({
    data: {
      direction: "IN",
      phone: e164,
      status: "RECEIVED",
      body: text,
      externalId: messageId
    }
  });

  // Trigger AI auto-reply asynchronously
  setTimeout(() => {
    import("../ai/autoreply").then(({ handleIncoming }) => {
      handleIncoming(msg.externalId!);
    }).catch(console.error);
  }, 0);
}
