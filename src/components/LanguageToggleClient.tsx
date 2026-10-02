"use client";

import { useState, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n/l10n";

export function LanguageToggleClient({ locale, text, className }: { locale: Locale; className: string; text: { english: string; hindi: string; changingLanguage: string; languageError: string } }) {
  const next = locale === "en" ? "hi" : "en";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return <div className="flex min-w-0 flex-col items-end gap-2">
    <button type="button" data-slot="button" lang={pending ? locale : next} disabled={pending} aria-busy={pending} aria-describedby={error ? "language-error" : undefined}
      className={`${className}${error ? " border-destructive ring-2 ring-destructive" : ""}`} onClick={() => {
        setError(false);
        startTransition(async () => { try { await setLocale(next); } catch { setError(true); } });
      }}>
      {pending ? text.changingLanguage : text[next === "hi" ? "hindi" : "english"]}
    </button>
    {error && <p id="language-error" role="alert" className="text-sm text-destructive">{text.languageError}</p>}
  </div>;
}
