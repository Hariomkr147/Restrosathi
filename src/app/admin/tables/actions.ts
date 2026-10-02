"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "@/lib/auth/session";
import * as tables from "@/lib/tables";

async function mutate(operation: () => Promise<Awaited<ReturnType<typeof tables.createTable>>>) {
  try {
    await requireUser("OWNER");
    const data = await operation();
    revalidatePath("/admin/tables"); revalidatePath("/admin/tables/print");
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: error instanceof AuthError ? "FORBIDDEN"
      : error instanceof tables.TableError ? error.code : "FAILED" };
  }
}
export async function createTable(label: string) { return mutate(() => tables.createTable(label)); }
export async function renameTable(id: string, label: string) { return mutate(() => tables.renameTable(id, label)); }
export async function setTableActive(id: string, active: boolean) { return mutate(() => tables.setTableActive(id, active)); }
export async function regenerateTableCode(id: string) { return mutate(() => tables.regenerateTableCode(id)); }
