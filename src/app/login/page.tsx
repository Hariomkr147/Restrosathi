import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("login");
  return <main className="mx-auto w-full max-w-md px-6 py-8">
    <h1 className="font-heading text-3xl">{t("ownerTitle")}</h1>
    <LoginForm />
    <Link href="/login/staff" className="mt-4 inline-flex min-h-touch items-center py-2 text-primary underline underline-offset-4">{t("staffTitle")}</Link>
  </main>;
}
