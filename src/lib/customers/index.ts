import { prisma as db } from "../db";
import { Prisma } from "@prisma/client";

function normalizePhone(phone: string): string {
  // basic E.164 normalization assuming India (+91) if not provided
  let normalized = phone.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    if (normalized.length === 10) {
      normalized = "+91" + normalized;
    } else if (normalized.startsWith("91") && normalized.length === 12) {
      normalized = "+" + normalized;
    }
  }
  return normalized;
}

export async function upsertCustomer(
  phone: string,
  data: { name?: string | null; verified?: boolean } = {},
  tx: Prisma.TransactionClient = db
) {
  const normPhone = normalizePhone(phone);
  
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
