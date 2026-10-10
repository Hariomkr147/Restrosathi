/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WaAkgProvider } from "./wa-akg";
import http from "node:http";

describe("WaAkgProvider", () => {
  let server: http.Server;
  let requestLogs: { method: string; url: string; headers: any; body: string }[] = [];
  let nextResponse: { status: number; body: any; delayMs?: number } = { status: 200, body: {} };

  beforeAll(async () => {
    return new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          requestLogs.push({ method: req.method || "", url: req.url || "", headers: req.headers, body });
          
          setTimeout(() => {
            res.writeHead(nextResponse.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(nextResponse.body));
          }, nextResponse.delayMs || 0);
        });
      });
      server.listen(0, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const port = (server.address() as any).port;
        process.env.WA_AKG_URL = `http://localhost:${port}`;
        process.env.WA_AKG_API_KEY = "test-api-key";
        process.env.WA_AKG_SESSION_ID = "test-session";
        resolve();
      });
    });
  });

  afterAll(async () => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("sendText sends correct path, header and body", async () => {
    requestLogs = [];
    nextResponse = { status: 200, body: { data: { key: { id: "msg-123" } } } };
    
    const provider = new WaAkgProvider();
    const result = await provider.sendText("+919876543210", "Hello test");
    
    expect(result.providerId).toBe("msg-123");
    expect(requestLogs.length).toBe(1);
    expect(requestLogs[0].method).toBe("POST");
    expect(requestLogs[0].url).toBe("/api/messages/test-session/919876543210@s.whatsapp.net/send");
    expect(requestLogs[0].headers["x-api-key"]).toBe("test-api-key");
    expect(JSON.parse(requestLogs[0].body)).toEqual({ message: { text: "Hello test" } });
  });

  it("sendText throws on non-2xx", async () => {
    nextResponse = { status: 400, body: { error: "bad" } };
    const provider = new WaAkgProvider();
    await expect(provider.sendText("+919876543210", "Hello")).rejects.toThrow("WaAkgProvider sendText failed: 400");
  });

  it("status() mapping for outcomes", async () => {
    const provider = new WaAkgProvider();
    
    // CONNECTED
    nextResponse = { status: 200, body: { status: "CONNECTED" } };
    expect(await provider.status()).toBe("connected");
    
    // connected
    nextResponse = { status: 200, body: { data: { state: "connected" } } };
    expect(await provider.status()).toBe("connected");
    
    // WORKING
    nextResponse = { status: 200, body: { state: "WORKING" } };
    expect(await provider.status()).toBe("connected");
    
    // anything else reachable -> disconnected
    nextResponse = { status: 200, body: { status: "STOPPED" } };
    expect(await provider.status()).toBe("disconnected");
    
    // 404/500 -> disconnected
    nextResponse = { status: 500, body: {} };
    expect(await provider.status()).toBe("disconnected");
    
    // network failure -> unknown
    // Temporarily overwrite URL to a bad one to force a network error
    const oldUrl = process.env.WA_AKG_URL;
    process.env.WA_AKG_URL = "http://localhost:1";
    const badProvider = new WaAkgProvider();
    expect(await badProvider.status()).toBe("unknown");
    process.env.WA_AKG_URL = oldUrl;
  });
});
