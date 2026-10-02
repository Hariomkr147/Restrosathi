import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NextIntlClientProvider } from "next-intl";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <NextIntlClientProvider>
    <div className="mx-auto w-full max-w-content px-6 py-4"><LanguageToggle /></div>
    {children}
  </NextIntlClientProvider>;
}
