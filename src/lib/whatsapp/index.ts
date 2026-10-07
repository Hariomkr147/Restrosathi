import { WhatsAppProvider } from "./provider";
import { FakeWhatsAppProvider } from "./fake";
import { WaAkgProvider } from "./wa-akg";

let providerInstance: WhatsAppProvider | null = null;

export function getWhatsApp(): WhatsAppProvider {
  if (providerInstance) return providerInstance;
  
  if (process.env.WHATSAPP_PROVIDER === "fake" && process.env.ALLOW_FAKE_WA === "1") {
    providerInstance = new FakeWhatsAppProvider();
  } else if (process.env.WHATSAPP_PROVIDER === "fake") {
    throw new Error("Fake WhatsApp provider requested but ALLOW_FAKE_WA=1 is not set. Refusing to start.");
  } else {
    providerInstance = new WaAkgProvider();
  }
  
  return providerInstance;
}
