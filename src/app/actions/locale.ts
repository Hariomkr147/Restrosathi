"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import type { Locale } from "@/lib/i18n/l10n";

export async function setLocale(locale: Locale): Promise<void> {
  const value = z.enum(["en", "hi"]).parse(locale);
  (await cookies()).set("NEXT_LOCALE", value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
