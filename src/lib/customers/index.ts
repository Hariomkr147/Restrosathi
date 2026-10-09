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

export async function listCustomers(params: { search?: string; page?: number; limit?: number }) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = { phone: { not: { startsWith: "+00deleted" } } };
  if (params.search) {
    where.OR = [
      { phone: { contains: params.search } },
      { name: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.customer.count({ where })
  ]);

  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerDetails(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      consentRecords: { orderBy: { at: "desc" } },
      loyaltyTxns: { orderBy: { at: "desc" }, take: 10 },
      feedbacks: { orderBy: { submittedAt: "desc" }, take: 5 },
    }
  });

  if (!customer || customer.phone.startsWith("+00deleted")) return null;
  
  const bills = await db.bill.findMany({
    where: { customerPhone: customer.phone },
    orderBy: { generatedAt: "desc" },
    take: 5,
    select: { id: true, number: true, totalPaise: true, generatedAt: true }
  });

  return { ...customer, bills };
}
