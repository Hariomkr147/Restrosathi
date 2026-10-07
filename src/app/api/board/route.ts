import { getBoard } from "@/lib/orders/board";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "OWNER" && user.role !== "STAFF") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = await getBoard();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      }
    });
  } catch (e) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
