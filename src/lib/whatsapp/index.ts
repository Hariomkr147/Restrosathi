import { WhatsAppProvider } from "./provider";
import { FakeWhatsAppProvider } from "./fake";
import { WaAkgProvider } from "./wa-akg";

let providerInstance: WhatsAppProvider | null = null;

export function getWhatsApp(): WhatsAppProvider {
  if (providerInstance) return providerInstance;
  
  if (process.env.WHATSAPP_PROVIDER === "fake") {
    providerInstance = new FakeWhatsAppProvider();
  } else {
    providerInstance = new WaAkgProvider();
  }
  
  return providerInstance;
}
