"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions/locale";
import { Button } from "./ui/button";

export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations("common");
  const next = locale === "en" ? "hi" : "en";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <div className="flex min-w-0 flex-col items-end gap-2">
      <Button type="button" variant="outline" lang={pending ? locale : next} disabled={pending} aria-busy={pending} aria-invalid={error || undefined}
        className="h-auto max-w-full break-words py-2 text-base"
        onClick={() => {
          setError(false);
          startTransition(async () => {
            try { await setLocale(next); }
            catch { setError(true); }
          });
        }}>
        {pending ? t("changingLanguage") : t(next === "hi" ? "hindi" : "english")}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{t("languageError")}</p>}
    </div>
  );
}
