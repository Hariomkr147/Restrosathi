import { requirePageUser } from "@/lib/auth/session";
import { getAllPackages } from "@/lib/events/packages";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PackageForm } from "./PackageForm";

export default async function AdminPackagesPage() {
  const user = await requirePageUser();
  if (user.role !== "OWNER") redirect("/admin/events");

  const packages = await getAllPackages();
  const t = await getTranslations("events");

  return (
    <main className="mx-auto w-full max-w-content px-6 py-4 space-y-[calc(var(--spacing)*4)]">
      <h1 className="text-2xl font-bold">{t("adminPackages")}</h1>

      <div className="space-y-[calc(var(--spacing)*4)]">
        {packages.map(pkg => (
          <PackageForm key={pkg.id} pkg={pkg} />
        ))}
        <PackageForm />
      </div>
    </main>
  );
}
