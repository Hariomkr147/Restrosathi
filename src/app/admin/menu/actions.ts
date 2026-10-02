"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { AuthError } from "@/lib/auth/session";
import * as menu from "@/lib/menu/mutations";
import { UploadError } from "@/lib/menu/images";

async function mutate<T>(operation: () => Promise<T>) {
  try {
    const data = await operation();
    revalidatePath("/"); revalidatePath("/menu"); revalidatePath("/admin/menu");
    return { ok: true as const, data };
  } catch (error) {
    const code = error instanceof AuthError ? "FORBIDDEN"
      : error instanceof menu.MenuEditError || error instanceof UploadError ? error.code
      : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025" ? "NOT_FOUND" : "FAILED";
    return { ok: false as const, error: code };
  }
}
export async function upsertCategory(input: unknown) { return mutate(() => menu.upsertCategory(input)); }
export async function deleteCategory(id: string) { return mutate(() => menu.deleteCategory(id)); }
export async function upsertItem(input: unknown) { return mutate(() => menu.upsertItem(input)); }
export async function deleteItem(id: string) { return mutate(() => menu.deleteItem(id)); }
export async function setItemAvailability(id: string, available: boolean) { return mutate(() => menu.setItemAvailability(id, available)); }
export async function reorderMenu(kind: "category" | "item", id: string, direction: "up" | "down") { return mutate(() => menu.reorderMenu(kind, id, direction)); }
export async function uploadMenuPhoto(form: FormData) { return mutate(() => menu.uploadMenuPhoto(form)); }
