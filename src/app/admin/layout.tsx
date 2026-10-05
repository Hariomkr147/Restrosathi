import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { LogoutButton } from "../login/LoginForm";
import { LanguageToggle } from "@/components/LanguageToggle";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();
  const t = await getTranslations("admin");
  return <NextIntlClientProvider>
    <div className="admin-chrome mx-auto w-full max-w-content px-6 py-4"><LanguageToggle /></div>
    <header className="admin-chrome mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0 break-words">
        <p className="font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">{t("role", { role: t(user.role) })}</p>
      </div>
      <LogoutButton />
    </header>
    <nav aria-label={t("navigation")} className="admin-chrome mx-auto flex w-full max-w-content flex-wrap gap-4 px-6">
      <Link href="/admin/board" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("board")}</Link>
      <Link href="/admin/orders/new" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("newOrder")}</Link>
      <Link href="/admin/bills" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("bills")}</Link>
      <Link href="/admin/menu" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("menu")}</Link>
      {user.role === "OWNER" && <Link href="/admin/settings" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("settings")}</Link>}
      {user.role === "OWNER" && <Link href="/admin/reports/day-end" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("reports")}</Link>}
      {user.role === "OWNER" && <Link href="/admin/tables" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("tables")}</Link>}
      <Link href="/admin/tables/print" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("printTables")}</Link>
    </nav>
    {children}
  </NextIntlClientProvider>;
}
