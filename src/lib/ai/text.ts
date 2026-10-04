import { getTranslations } from "next-intl/server";
import type { AssistantText } from "@/components/table/AssistantText";

export async function getAssistantText(): Promise<AssistantText> {
  const t = await getTranslations("assistant");
  return {
    button: t("button"),
    title: t("title"),
    placeholder: t("placeholder"),
    send: t("send"),
    allergy: t("allergy"),
    fallback: t("fallback"),
    limit_device: t("limit_device"),
    limit_month: t("limit_month"),
    too_long: t("too_long"),
    empty: t("empty")
  };
}
