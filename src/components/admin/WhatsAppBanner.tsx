import { getWhatsAppHealth } from "@/lib/whatsapp/health";


export async function WhatsAppBanner() {
  if (process.env.WHATSAPP_PROVIDER === "none") return null;

  const health = await getWhatsAppHealth();
  if (health.status === "connected" && health.failed === 0) return null;

  return (
    <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm font-medium flex items-center justify-center border-b border-amber-200">
      <span role="alert" id="wa-banner">
        WhatsApp is not connected. Messages are saved and will be sent when it reconnects.
      </span>
    </div>
  );
}
