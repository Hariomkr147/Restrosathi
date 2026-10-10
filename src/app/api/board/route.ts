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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.name === "AuthError" || e.message === "Unauthorized") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.error("Board API error:", e);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
