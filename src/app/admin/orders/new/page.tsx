import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StaffOrderForm } from "./StaffOrderForm";
import { getPublicMenu } from "@/lib/menu/queries";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("newOrder") };
}

export default async function NewOrderPage() {
  await requirePageUser();
  const tables = await prisma.restaurantTable.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  
  const openSessions = await prisma.diningSession.findMany({ where: { status: { not: "CLOSED" }, kind: "DINE_IN" } });
  const openTableIds = new Set(openSessions.map(s => s.tableId));

  const tablesWithStatus = tables.map(t => ({
    id: t.id,
    label: t.label,
    occupied: openTableIds.has(t.id)
  }));

  const menu = await getPublicMenu();

  return (
    <main className="mx-auto max-w-content px-6 py-8 pb-28">
      <StaffOrderForm tables={tablesWithStatus} menu={menu} />
    </main>
  );
}
