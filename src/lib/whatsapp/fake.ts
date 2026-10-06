import { WhatsAppProvider } from "./provider";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { existsSync } from "node:fs";

export class FakeWhatsAppProvider implements WhatsAppProvider {
  messages: { toE164: string; text: string }[] = [];

  constructor() {
    if (process.env.ALLOW_FAKE_WA !== "1") {
      throw new Error("ALLOW_FAKE_WA=1 is required to use the fake WhatsApp provider");
    }
  }

  private async getControlState(): Promise<"connected" | "disconnected" | "fail"> {
    const file = process.env.FAKE_WA_CONTROL;
    if (!file || !existsSync(file)) return "connected";
    const data = await fs.readFile(file, "utf8");
    const word = data.trim();
    if (word === "disconnected" || word === "fail") return word;
    return "connected";
  }

  async sendText(toE164: string, text: string): Promise<{ providerId: string }> {
    const state = await this.getControlState();
    if (state === "fail") {
      throw new Error("Fake provider is in fail state");
    }

    this.messages.push({ toE164, text });

    const outboxFile = process.env.FAKE_WA_OUTBOX;
    if (outboxFile) {
      const line = JSON.stringify({ toE164, text }) + "\n";
      await fs.appendFile(outboxFile, line, "utf8");
    }

    return { providerId: `fake-${crypto.randomUUID()}` };
  }

  async status(): Promise<"connected" | "disconnected" | "unknown"> {
    const state = await this.getControlState();
    if (state === "fail" || state === "disconnected") return "disconnected";
    return "connected";
  }
}
