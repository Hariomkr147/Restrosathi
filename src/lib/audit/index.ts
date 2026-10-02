import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";

export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  data?: unknown;
}, db: Prisma.TransactionClient = prisma): Promise<void> {
  const data = entry.data === undefined ? undefined : z.json().parse(entry.data);
  await db.auditLog.create({
    data: { ...entry, data: data === null ? Prisma.JsonNull : data },
  });
}
