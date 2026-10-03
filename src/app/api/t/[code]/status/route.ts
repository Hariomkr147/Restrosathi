import { getSessionView } from "@/lib/orders/session-view";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const view = await getSessionView((await params).code);
  return view ? Response.json(view, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
