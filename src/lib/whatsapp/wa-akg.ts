import { WhatsAppProvider } from "./provider";

export const WA_PATHS = {
  sendText: (sessionId: string, jid: string) => `/api/messages/${sessionId}/${jid}/send`,
  sessionStatus: (sessionId: string) => `/api/sessions/${sessionId}`,
};

export class WaAkgProvider implements WhatsAppProvider {
  private url: string;
  private apiKey: string;
  private sessionId: string;
  private statusPathOverride?: string;

  constructor() {
    this.url = process.env.WA_AKG_URL || "";
    this.apiKey = process.env.WA_AKG_API_KEY || "";
    this.sessionId = process.env.WA_AKG_SESSION_ID || "";
    this.statusPathOverride = process.env.WA_AKG_STATUS_PATH;
  }

  async sendText(toE164: string, text: string): Promise<{ providerId: string }> {
    const digits = toE164.replace("+", "");
    const jid = `${digits}@s.whatsapp.net`;
    const path = WA_PATHS.sendText(this.sessionId, jid);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${this.url}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify({ message: { text } }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`WaAkgProvider sendText failed: ${res.status} ${res.statusText}`);
      }
      
      const body = await res.json().catch(() => ({}));
      const messageId = body?.data?.key?.id || `sent-${Date.now()}`;
      return { providerId: messageId };
    } finally {
      clearTimeout(timeout);
    }
  }

  async status(): Promise<"connected" | "disconnected" | "unknown"> {
    const path = this.statusPathOverride || WA_PATHS.sessionStatus(this.sessionId);
    try {
      const res = await fetch(`${this.url}${path}`, {
        headers: { "X-API-Key": this.apiKey },
      });
      if (!res.ok) return "disconnected";
      const body = await res.json();
      const st = body?.status || body?.state || body?.data?.status || body?.data?.state;
      if (st === "CONNECTED" || st === "connected" || st === "WORKING") {
        return "connected";
      }
      return "disconnected";
    } catch {
      return "unknown";
    }
  }
}
