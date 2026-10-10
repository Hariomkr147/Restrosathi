/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, beforeEach, vi, afterEach } from "vitest";
import { prisma } from "../db";
import { handleIncoming } from "./autoreply";
import { getProvider } from "./index";

beforeEach(async () => {
  await prisma.messageLog.deleteMany({});
  await prisma.threadState.deleteMany({});
  await prisma.optOut.deleteMany({});
  await prisma.aiUsage.deleteMany({});
  
  // mock process.env
  vi.stubEnv("AI_MONTHLY_CAP", "100");
  vi.stubEnv("AI_AUTOREPLY_DAILY_LIMIT", "3");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("hours question gets a reply built from facts and aiHandled = true", async () => {
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543210", status: "RECEIVED", body: "What are your hours?", externalId: "m1" }
  });

  const provider = getProvider();
  vi.spyOn(provider, "complete").mockResolvedValue({ text: JSON.stringify({ reply: "We are open 10:00 to 23:00", needsHuman: false }) });

  await handleIncoming(msg.externalId!);

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.aiHandled).toBe(true);
  expect(updatedMsg?.needsHuman).toBe(false);

  const reply = await prisma.messageLog.findFirst({
    where: { direction: "OUT", kind: "AUTO_REPLY", phone: "+919876543210" },
    orderBy: { createdAt: "desc" }
  });
  expect(reply?.params).toMatchObject({ answer: "We are open 10:00 to 23:00" });
});

test("reply mentioning a price not in the facts -> handover", async () => {
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543211", status: "RECEIVED", body: "Price of dosa?", externalId: "m2" }
  });

  const provider = getProvider();
  // facts won't contain 9999 since we deleted menu items
  vi.spyOn(provider, "complete").mockResolvedValue({ text: JSON.stringify({ reply: "It is Rs. 9999", needsHuman: false }) });

  await handleIncoming(msg.externalId!);

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.aiHandled).toBe(true);
  expect(updatedMsg?.needsHuman).toBe(true);
  
  const reply = await prisma.messageLog.findFirst({
    where: { direction: "OUT", kind: "AUTO_REPLY", phone: "+919876543211" },
    orderBy: { createdAt: "desc" }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((reply?.params as any).answer).toBe("Thanks! Our staff will reply shortly.");
});

test("reply saying 'your table is confirmed' -> handover", async () => {
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543212", status: "RECEIVED", body: "Book a table", externalId: "m3" }
  });

  const provider = getProvider();
  vi.spyOn(provider, "complete").mockResolvedValue({ text: JSON.stringify({ reply: "Your table is confirmed", needsHuman: false }) });

  await handleIncoming(msg.externalId!);

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.needsHuman).toBe(true);
});

test("provider error -> handover", async () => {
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543213", status: "RECEIVED", body: "Hello", externalId: "m4" }
  });

  const provider = getProvider();
  vi.spyOn(provider, "complete").mockRejectedValue(new Error("API Down"));

  await handleIncoming(msg.externalId!);

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.needsHuman).toBe(true);
});

test("invalid JSON -> handover", async () => {
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543214", status: "RECEIVED", body: "Hello", externalId: "m5" }
  });

  const provider = getProvider();
  vi.spyOn(provider, "complete").mockResolvedValue({ text: "Not JSON" });

  await handleIncoming(msg.externalId!);

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.needsHuman).toBe(true);
});

test("allergy question -> fixed handover with zero provider calls", async () => {
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543215", status: "RECEIVED", body: "Does it have gluten?", externalId: "m6" }
  });

  const provider = getProvider();
  const spy = vi.spyOn(provider, "complete");

  await handleIncoming(msg.externalId!);

  expect(spy).not.toHaveBeenCalled();

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.needsHuman).toBe(true);

  const reply = await prisma.messageLog.findFirst({
    where: { direction: "OUT", kind: "AUTO_REPLY", phone: "+919876543215" },
    orderBy: { createdAt: "desc" }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((reply?.params as any).answer).toBe("Please ask our staff about allergies.");
});

test("paused thread -> no reply at all", async () => {
  await prisma.threadState.create({
    data: { phone: "+919876543216", aiPausedUntil: new Date(Date.now() + 100000) }
  });
  
  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543216", status: "RECEIVED", body: "Hello", externalId: "m7" }
  });

  await handleIncoming(msg.externalId!);

  const reply = await prisma.messageLog.findFirst({
    where: { direction: "OUT", phone: "+919876543216" }
  });
  expect(reply).toBeNull();
});

test("over daily limit -> no reply and needsHuman", async () => {
  for(let i=0; i<3; i++) {
    await prisma.messageLog.create({
      data: { direction: "OUT", kind: "AUTO_REPLY", phone: "+919876543217", status: "PENDING" }
    });
  }

  const msg = await prisma.messageLog.create({
    data: { direction: "IN", phone: "+919876543217", status: "RECEIVED", body: "Hello", externalId: "m8" }
  });

  const provider = getProvider();
  const spy = vi.spyOn(provider, "complete");

  await handleIncoming(msg.externalId!);

  expect(spy).not.toHaveBeenCalled();

  const updatedMsg = await prisma.messageLog.findUnique({ where: { id: msg.id } });
  expect(updatedMsg?.needsHuman).toBe(true);

  const outMsgs = await prisma.messageLog.count({
    where: { direction: "OUT", phone: "+919876543217" }
  });
  expect(outMsgs).toBe(3); // no new OUT message
});
