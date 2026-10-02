import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { MenuChoiceError, priceLine } from "../menu/pricing";
import { checkRate } from "../rate-limit";
import { getOrOpenTableSession } from "../sessions";
import { placeOrderInput } from "./schemas";

type Failure = { ok: false; error: "TABLE_NOT_FOUND" | "ITEM_UNAVAILABLE" | "CHOICE_INVALID" | "RATE_LIMITED" | "INVALID_INPUT"; itemId?: string };
type Result = { ok: true; orderId: string; duplicate: boolean } | Failure;
class PlacementError extends Error {
  constructor(public error: Failure["error"], public itemId?: string) { super(error); }
}
const hour = 3_600_000;

// Public QR mutation: choices are validated and prices always come from the database.
export async function placeOrder(input: unknown, ctx: { deviceId: string; ip: string }): Promise<Result> {
  const parsed = placeOrderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const data = parsed.data;
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
  if (existing) return { ok: true, orderId: existing.id, duplicate: true };
  try {
    return await prisma.$transaction(async (tx): Promise<Result> => {
      // Serialize retries before charging rates; every hit rolls back with a failed creation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('order:' || ${data.idempotencyKey}, 0))`;
      const duplicate = await tx.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (duplicate) return { ok: true, orderId: duplicate.id, duplicate: true };
      const configuredIpLimit = Number(process.env.RATE_LIMIT_IP_ORDERS_PER_HOUR ?? 60);
      const ipLimit = Number.isSafeInteger(configuredIpLimit) && configuredIpLimit > 0 ? configuredIpLimit : 60;
      if (!await checkRate(`device:${ctx.deviceId}`, 20, hour, tx) || !await checkRate(`ip:${ctx.ip}`, ipLimit, hour, tx)) {
        throw new PlacementError("RATE_LIMITED");
      }
      const table = await tx.restaurantTable.findFirst({ where: { code: data.tableCode, active: true } });
      if (!table) throw new PlacementError("TABLE_NOT_FOUND");
      const menu = await tx.menuItem.findMany({ where: { id: { in: data.items.map(({ itemId }) => itemId) } },
        include: { variants: true, modifierGroups: { include: { options: true } } } });
      const lines = data.items.map((choice) => {
        const item = menu.find(({ id }) => id === choice.itemId);
        if (!item?.available) throw new PlacementError("ITEM_UNAVAILABLE", choice.itemId);
        let unitPricePaise: number;
        try { unitPricePaise = priceLine(item, choice); }
        catch (error) {
          if (error instanceof MenuChoiceError) throw new PlacementError("CHOICE_INVALID", item.id);
          throw error;
        }
        if (!Number.isSafeInteger(unitPricePaise) || unitPricePaise < 1 || unitPricePaise > 2147483647) throw new PlacementError("CHOICE_INVALID", item.id);
        const variant = item.variants.find(({ id }) => id === choice.variantId);
        const selected = new Set(choice.optionIds);
        return { itemId: item.id, nameSnapshot: item.name as Prisma.InputJsonValue,
          variantSnapshot: variant ? variant.name as Prisma.InputJsonValue : Prisma.DbNull,
          modifiersSnapshot: item.modifierGroups.flatMap((group) => group.options.filter(({ id }) => selected.has(id)).map(({ name }) => name)) as Prisma.InputJsonValue,
          qty: choice.qty, unitPricePaise, note: choice.note };
      });
      const session = await getOrOpenTableSession(tx, table.id);
      if (!await checkRate(`session:${session.id}`, 30, hour, tx)) throw new PlacementError("RATE_LIMITED");
      const order = await tx.order.create({ data: { sessionId: session.id, idempotencyKey: data.idempotencyKey,
        source: "QR", customerName: data.customerName, lines: { create: lines } } });
      return { ok: true, orderId: order.id, duplicate: false };
    }, { maxWait: 20_000, timeout: 30_000 });
  } catch (error) {
    // Any unique conflict has already rolled back the transaction before this read.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
        Array.isArray(error.meta?.target) && error.meta.target.includes("idempotencyKey")) {
      const winner = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (winner) return { ok: true, orderId: winner.id, duplicate: true };
    }
    if (error instanceof PlacementError) return { ok: false, error: error.error, ...(error.itemId ? { itemId: error.itemId } : {}) };
    throw error;
  }
}
