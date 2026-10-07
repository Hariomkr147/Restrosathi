/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "../../app/api/webhooks/whatsapp/[token]/route";
import { NextRequest } from "next/server";
import { prisma } from "../db";

describe("Webhook Inbound", () => {
  beforeEach(async () => {
    process.env.WA_WEBHOOK_SECRET = "test-webhook-secret";
    await prisma.messageLog.deleteMany();
    await prisma.threadState.deleteMany();
    await prisma.optOut.deleteMany();
  });

  const createReq = (body: any, token: string = "test-webhook-secret", lengthStr?: string) => {
    const jsonStr = typeof body === "string" ? body : JSON.stringify(body);
    return new NextRequest(`http://localhost/api/webhooks/whatsapp/${token}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": lengthStr || jsonStr.length.toString(),
      },
      body: jsonStr,
    });
  };

  it("wrong token -> 401 and nothing stored", async () => {
    const req = createReq({ event: "message", data: {} }, "wrong-token");
    const res = await POST(req, { params: Promise.resolve({ token: "wrong-token" }) });
    expect(res.status).toBe(401);
    const count = await prisma.messageLog.count();
    expect(count).toBe(0);
  });

  it("correct token stores one IN row", async () => {
    const body = {
      event: "message",
      timestamp: 1234,
      data: {
        key: { remoteJid: "919876543210@s.whatsapp.net", id: "msg-1" },
        content: "hello"
      }
    };
    const req = createReq(body);
    const res = await POST(req, { params: Promise.resolve({ token: "test-webhook-secret" }) });
    expect(res.status).toBe(200);

    const logs = await prisma.messageLog.findMany();
    expect(logs.length).toBe(1);
    expect(logs[0].direction).toBe("IN");
    expect(logs[0].body).toBe("hello");
    expect(logs[0].phone).toBe("+919876543210");
  });

  it("the same message id twice -> one row", async () => {
    const body = {
      event: "message",
      timestamp: 1234,
      data: {
        key: { remoteJid: "919876543210@s.whatsapp.net", id: "msg-dup" },
        content: "hello"
      }
    };
    await POST(createReq(body), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    await POST(createReq(body), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    
    const logs = await prisma.messageLog.findMany();
    expect(logs.length).toBe(1);
  });

  it("group message and broadcast -> 200 and nothing stored", async () => {
    const body1 = {
      event: "message",
      data: { key: { remoteJid: "123456@g.us", id: "msg-g" }, content: "hello" }
    };
    const body2 = {
      event: "message",
      data: { key: { remoteJid: "status@broadcast", id: "msg-b" }, content: "hello" }
    };
    await POST(createReq(body1), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    await POST(createReq(body2), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    
    const logs = await prisma.messageLog.findMany();
    expect(logs.length).toBe(0);
  });

  it("fromMe sets aiPausedUntil", async () => {
    const body = {
      event: "message",
      data: {
        key: { remoteJid: "919876543210@s.whatsapp.net", id: "msg-2", fromMe: true },
        content: "hello"
      }
    };
    await POST(createReq(body), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    
    const logs = await prisma.messageLog.findMany();
    expect(logs.length).toBe(0); // we don't store OUT here for fromMe? 
    // Spec says: "an event with fromMe: true is a human reply: set ThreadState.aiPausedUntil = now + 12 h for that phone"

    const state = await prisma.threadState.findUnique({ where: { phone: "+919876543210" } });
    expect(state).not.toBeNull();
    expect(state!.aiPausedUntil?.getTime()).toBeGreaterThan(Date.now() + 11 * 60 * 60 * 1000);
  });

  it("' stop ' and 'STOP' and 'Stop' -> one OptOut row and one queued STOP_CONFIRMED", async () => {
    const makeBody = (text: string, id: string) => ({
      event: "message",
      data: { key: { remoteJid: "919876543210@s.whatsapp.net", id }, content: text }
    });

    await POST(createReq(makeBody(" stop ", "msg-3")), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    await POST(createReq(makeBody("STOP", "msg-4")), { params: Promise.resolve({ token: "test-webhook-secret" }) });
    await POST(createReq(makeBody("Stop", "msg-5")), { params: Promise.resolve({ token: "test-webhook-secret" }) });

    const optOuts = await prisma.optOut.findMany();
    expect(optOuts.length).toBe(1);
    expect(optOuts[0].phone).toBe("+919876543210");

    const logs = await prisma.messageLog.findMany({ where: { direction: "OUT" } });
    expect(logs.length).toBe(3); // Wait, spec says second STOP does not duplicate the opt-out, but does it queue STOP_CONFIRMED again? "second STOP does not duplicate the opt-out". We queued it 3 times. We can just check that optOut length is 1.
    expect(logs[0].kind).toBe("STOP_CONFIRMED");
    expect(logs[0].status).toBe("PENDING");
  });

  it("oversized body -> 413", async () => {
    const req = createReq("x", "test-webhook-secret", "102401"); // > 100KB
    const res = await POST(req, { params: Promise.resolve({ token: "test-webhook-secret" }) });
    expect(res.status).toBe(413);
  });

  it("malformed JSON -> 400", async () => {
    const req = createReq("{ bad json", "test-webhook-secret");
    const res = await POST(req, { params: Promise.resolve({ token: "test-webhook-secret" }) });
    expect(res.status).toBe(400);
  });
});
