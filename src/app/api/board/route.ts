import { getBoard } from "@/lib/orders/board";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await getBoard();
    return NextResponse.json(data);
  } catch (e) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
