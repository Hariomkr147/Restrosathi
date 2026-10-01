import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "RestroSathi",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <div className="mx-auto w-full max-w-content px-6 py-4"><LanguageToggle /></div>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
