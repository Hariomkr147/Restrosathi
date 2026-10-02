import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/lib/auth/session";
import { getAdminMenu } from "@/lib/menu/queries";
import { ItemForm } from "./ItemForm";

export default async function ItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  await requirePageUser("OWNER");
  const { itemId } = await params;
  const [menu, t] = await Promise.all([getAdminMenu(), getTranslations("menuAdmin")]);
  const item = menu.categories.flatMap((entry) => entry.items).find((entry) => entry.id === itemId);
  if (itemId !== "new" && !item) notFound();
  return <main className="mx-auto w-full max-w-content px-6 py-8">
    <h1 className="font-heading text-3xl">{t(item ? "editItem" : "addItem")}</h1>
    <ItemForm item={item} categories={menu.categories.map(({ id, name }) => ({ id, name }))} />
  </main>;
}
