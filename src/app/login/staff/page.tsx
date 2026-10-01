import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getActiveStaff } from "@/lib/auth/session";
import { LoginForm } from "../LoginForm";

export default async function StaffLoginPage() {
  const t = await getTranslations("login");
  const staff = await getActiveStaff();
  return <main className="mx-auto w-full max-w-md px-6 py-8">
    <h1 className="font-heading text-3xl">{t("staffTitle")}</h1>
    <LoginForm staff={staff} />
    <Link href="/login" className="mt-4 inline-flex min-h-touch items-center py-2 text-primary underline underline-offset-4">{t("ownerTitle")}</Link>
  </main>;
}
