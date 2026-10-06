import { requirePageUser } from "@/lib/auth/session";
import { getEnquiries } from "@/lib/events/enquiries";
import { getTranslations } from "next-intl/server";
import { EnquiryRow } from "./EnquiryRow";
import Link from "next/link";

export default async function AdminEventsPage() {
  const user = await requirePageUser();
  const enquiries = await getEnquiries();
  const t = await getTranslations("events");

  return (
    <main className="mx-auto w-full max-w-content px-6 py-4 space-y-[calc(var(--spacing)*4)]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("adminTitle")}</h1>
        {user.role === "OWNER" && (
          <Link href="/admin/events/packages" className="px-4 py-2 bg-primary text-primary-contrast rounded-sm font-bold">
            {t("adminPackages")}
          </Link>
        )}
      </div>

      <div className="space-y-[calc(var(--spacing)*4)]">
        {enquiries.map(enq => (
          <EnquiryRow key={enq.id} enquiry={enq} t={{
            statusNEW: t("statusNEW"),
            statusQUOTED: t("statusQUOTED"),
            statusCONFIRMED: t("statusCONFIRMED"),
            statusLOST: t("statusLOST"),
            quote: t("quote"),
            notes: t("notes"),
            save: t("save"),
            guests: t("guests"),
          }} />
        ))}
      </div>
    </main>
  );
}
