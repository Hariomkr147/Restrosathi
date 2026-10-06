export interface WhatsAppProvider {
  sendText(toE164: string, text: string): Promise<{ providerId: string }>;
  status(): Promise<"connected" | "disconnected" | "unknown">;
}
