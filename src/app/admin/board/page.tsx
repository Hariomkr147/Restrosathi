import { requirePageUser } from "@/lib/auth/session";
import { getBoard } from "@/lib/orders/board";
import { BoardClient } from "./BoardClient";
import { getTranslations } from "next-intl/server";

export const metadata = { title: "Kitchen Board" };

export default async function BoardPage() {
  await requirePageUser();
  const t = await getTranslations("board");
  
  // We don't fetch data here, we let the client fetch it via polling/actions, 
  // or we can seed the initial data. The prompt says "Polls getBoard every 3 s".
  // Passing initial data avoids a loading state.
  const initialData = await getBoard();
  
  return <BoardClient initialData={initialData} />;
}
