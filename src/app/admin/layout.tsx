import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { LogoutButton } from "../login/LoginForm";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();
  const t = await getTranslations("admin");
  return <>
    <div className="mx-auto w-full max-w-content px-6 py-4"><LanguageToggle /></div>
    <header className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0 break-words">
        <p className="font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">{t("role", { role: t(user.role) })}</p>
      </div>
      <LogoutButton />
    </header>
    {children}
  </>;
}
