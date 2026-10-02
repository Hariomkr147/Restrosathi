"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const t = useTranslations("tables");
  return <Button type="button" onClick={() => window.print()}>{t("printNow")}</Button>;
}
