import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { AddStaffForm, StaffItemRow, ChangePasswordForm } from "./StaffForms";

export default async function StaffPage() {
  await requirePageUser("OWNER");
  const t = await getTranslations();
  
  const staffList = await prisma.user.findMany({
    where: { role: "STAFF" },
    orderBy: { name: "asc" }
  });

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.STAFF")} Accounts</h1>
      
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">Add Staff</h2>
        <AddStaffForm />
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="text-xl font-bold mb-2">Staff Members</h2>
        <div className="divide-y">
          {staffList.map(staff => (
            <StaffItemRow key={staff.id} staff={staff} />
          ))}
          {staffList.length === 0 && (
            <p className="py-4 text-muted-foreground">No staff members found.</p>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">Owner Password</h2>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
