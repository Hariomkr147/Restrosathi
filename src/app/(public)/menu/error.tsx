"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function MenuError({ reset }: { reset: () => void }) {
  const t = useTranslations("menu");
  return <main id="main" className="mx-auto w-full max-w-content space-y-4 px-6 py-8">
    <h1 className="font-heading text-3xl">{t("title")}</h1>
    <p role="alert">{t("loadError")}</p>
    <Button onClick={reset}>{t("retry")}</Button>
  </main>;
}
