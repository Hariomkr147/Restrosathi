import { getTranslations } from "next-intl/server";
import { Button } from "./ui/button";
import { whatsappChatUrl } from "@/lib/seo/jsonld";

export async function FloatingContact({ phone, whatsappPhone }: { phone: string; whatsappPhone: string }) {
  const t = await getTranslations("common");
  return <aside aria-label={t("contact")} className="floating-contact fixed z-20 flex flex-wrap justify-end gap-2">
    <Button asChild variant="outline" className="h-auto whitespace-normal py-2 text-base"><a href={`tel:${phone}`}>{t("call")}</a></Button>
    <Button asChild className="h-auto whitespace-normal py-2 text-base"><a href={whatsappChatUrl(whatsappPhone)}>{t("whatsapp")}</a></Button>
  </aside>;
}
