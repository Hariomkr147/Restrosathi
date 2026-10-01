import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";

export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  data?: unknown;
}): Promise<void> {
  const data = entry.data === undefined ? undefined : z.json().parse(entry.data);
  await prisma.auditLog.create({
    data: { ...entry, data: data === null ? Prisma.JsonNull : data },
  });
}
