import { z } from "zod";

const id = z.string().min(1).max(100);
export const placeOrderInput = z.object({
  tableCode: z.string().length(10),
  idempotencyKey: z.uuid(),
  customerName: z.string().trim().max(60).optional(),
  items: z.array(z.object({
    itemId: id,
    variantId: id.optional(),
    optionIds: z.array(id).max(100),
    qty: z.number().int().min(1).max(20),
    note: z.string().trim().max(200).optional(),
  })).min(1).max(30),
});
