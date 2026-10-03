import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { MenuTextProvider } from "@/components/menu/MenuText";
import { TableTextProvider } from "@/components/table/TableText";
import { getMenuText } from "@/lib/menu/text";
import { getTableText } from "@/lib/orders/text";
import { findActiveTableByCode } from "@/lib/tables";

export default async function TableLayout({ children, params }: { children: ReactNode; params: Promise<{ code: string }> }) {
  // Resolve invalid codes before the page's loading boundary can commit a streamed 200.
  if (!await findActiveTableByCode((await params).code)) notFound();
  const [menu, table] = await Promise.all([getMenuText(), getTableText()]);
  return <MenuTextProvider value={menu}><TableTextProvider value={table}>{children}</TableTextProvider></MenuTextProvider>;
}
