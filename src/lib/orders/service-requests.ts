import { z } from "zod";
import { prisma } from "../db";
import { checkRate } from "../rate-limit";
import { getOrOpenTableSession, markBillRequested } from "../sessions";

type Result = { ok: true; already: boolean } | { ok: false; error: "INVALID_INPUT" | "TABLE_NOT_FOUND" | "RATE_LIMITED" };
class ServiceError extends Error { constructor(public code: "RATE_LIMITED") { super(code); } }
const input = z.object({ code: z.string().length(10), kind: z.enum(["CALL_WAITER", "REQUEST_BILL"]) });
// Public: table code plus a device-scoped rate cap, serialized on the shared table lock.
export async function createServiceRequest(code: unknown, kind: unknown, ctx: { deviceId: string; ip: string }): Promise<Result> {
  const parsed = input.safeParse({ code, kind });
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  try {
    return await prisma.$transaction(async (tx): Promise<Result> => {
      const table = await tx.restaurantTable.findFirst({ where: { code: parsed.data.code, active: true } });
      if (!table) return { ok: false, error: "TABLE_NOT_FOUND" };
      const session = await getOrOpenTableSession(tx, table.id);
      const open = await tx.serviceRequest.findFirst({ where: { sessionId: session.id, kind: parsed.data.kind, resolvedAt: null } });
      if (open) return { ok: true, already: true };
      if (!await checkRate(`service:${ctx.deviceId}:${parsed.data.kind}`, 10, 3_600_000, tx)) throw new ServiceError("RATE_LIMITED");
      await tx.serviceRequest.create({ data: { sessionId: session.id, kind: parsed.data.kind } });
      if (parsed.data.kind === "REQUEST_BILL") await markBillRequested(tx, session.id);
      return { ok: true, already: false };
    }, { maxWait: 20_000, timeout: 30_000 });
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.code };
    throw error;
  }
}
