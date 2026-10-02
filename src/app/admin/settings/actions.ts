"use server";

import { revalidatePath } from "next/cache";
import { updateSettings as save } from "@/lib/settings";

export async function updateSettings(input: unknown) {
  const result = await save(input);
  if (result.ok) { revalidatePath("/"); revalidatePath("/menu"); revalidatePath("/admin/settings"); }
  return result;
}
