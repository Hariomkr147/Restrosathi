import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { MenuTextProvider } from "@/components/menu/MenuText";
import { TableTextProvider } from "@/components/table/TableText";
import { AssistantTextProvider } from "@/components/table/AssistantText";
import { getMenuText } from "@/lib/menu/text";
import { getTableText } from "@/lib/orders/text";
import { getAssistantText } from "@/lib/ai/text";
import { findActiveTableByCode } from "@/lib/tables";

export default async function TableLayout({ children, params }: { children: ReactNode; params: Promise<{ code: string }> }) {
  // Resolve invalid codes before the page's loading boundary can commit a streamed 200.
  if (!await findActiveTableByCode((await params).code)) notFound();
  const [menu, table, ai] = await Promise.all([getMenuText(), getTableText(), getAssistantText()]);
  return <MenuTextProvider value={menu}><TableTextProvider value={table}><AssistantTextProvider value={ai}>{children}</AssistantTextProvider></TableTextProvider></MenuTextProvider>;
}
