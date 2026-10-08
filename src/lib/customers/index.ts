import { prisma as db } from "../db";
import { Prisma } from "@prisma/client";

import { normalizePhone } from "../phone";
export async function upsertCustomer(
  phone: string,
  data: { name?: string | null; verified?: boolean } = {},
  tx: Prisma.TransactionClient = db
) {
  const normPhone = normalizePhone(phone);
  if (!normPhone) throw new Error("INVALID_PHONE");
  
  const existing = await tx.customer.findUnique({
    where: { phone: normPhone },
  });

  const updateData: Prisma.CustomerUpdateInput = {};
  if (data.name && (!existing?.name || existing.name !== data.name)) {
    updateData.name = data.name;
  }
  if (data.verified && !existing?.verifiedAt) {
    updateData.verifiedAt = new Date();
  }

  if (existing) {
    if (Object.keys(updateData).length > 0) {
      return await tx.customer.update({
        where: { id: existing.id },
        data: updateData,
      });
    }
    return existing;
  }

  return await tx.customer.create({
    data: {
      phone: normPhone,
      name: data.name ?? null,
      verifiedAt: data.verified ? new Date() : null,
    },
  });
}
