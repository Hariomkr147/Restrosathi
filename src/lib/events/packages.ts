import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { eventPackageSchema } from "./schemas";
import { z } from "zod";

export async function getActivePackages() {
  return await prisma.eventPackage.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAllPackages() {
  await requireUser("OWNER");
  return await prisma.eventPackage.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function upsertPackageAction(id: string | null, data: z.infer<typeof eventPackageSchema>) {
  await requireUser("OWNER");
  const parsed = eventPackageSchema.parse(data);
  if (id) {
    await prisma.eventPackage.update({
      where: { id },
      data: parsed,
    });
  } else {
    await prisma.eventPackage.create({
      data: parsed,
    });
  }
  return { ok: true as const };
}
