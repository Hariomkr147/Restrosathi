import { getTranslations } from "next-intl/server";
import messages from "../../../messages/en.json";
import { buttonVariants } from "@/components/ui/button";
import type { TableText } from "@/components/table/TableText";

export async function getTableText(): Promise<TableText> {
  const t = await getTranslations("table");
  return { ...Object.fromEntries(Object.keys(messages.table).map((key) => [key, key === "tableLabel" ? t(key, { label: "" }) : t(key)])) as Record<keyof typeof messages.table, string>,
    buttonClass: buttonVariants(), outlineClass: buttonVariants({ variant: "outline" }) };
}
