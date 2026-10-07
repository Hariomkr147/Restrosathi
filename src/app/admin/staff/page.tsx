import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function StaffPage() {
  await requirePageUser("OWNER");
  const t = await getTranslations();
  
  const staffList = await prisma.user.findMany({
    where: { role: "STAFF" },
    orderBy: { name: "asc" }
  });

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("staff")}</h1>
      
      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        {staffList.map(staff => (
          <div key={staff.id} className="flex justify-between items-center border-b pb-2">
            <div>
              <p className="font-semibold">{staff.name}</p>
              <p className="text-sm text-gray-500">{staff.active ? "Active" : "Inactive"}</p>
            </div>
            {/* Form actions for reset PIN and toggle active would go here */}
          </div>
        ))}
      </div>
      
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">Add Staff</h2>
        {/* Form action to add staff would go here */}
      </div>
    </main>
  );
}
