"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPasswordLogin, checkPinLogin } from "@/lib/auth/login";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";

async function clientIp(): Promise<string> {
  const value = (await headers()).get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return value && isIP(value) ? value : "unknown";
}

export async function loginWithPassword(form: { phone: string; password: string }): Promise<{ error: "invalid" | "locked" } | void> {
  const result = await checkPasswordLogin(form, await clientIp());
  if ("error" in result) return result;
  await createSession(result.userId);
  redirect("/admin");
}

export async function loginWithPin(form: { userId: string; pin: string }): Promise<{ error: "invalid" | "locked" } | void> {
  const result = await checkPinLogin(form, await clientIp());
  if ("error" in result) return result;
  await createSession(result.userId);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await requireUser();
  await destroySession();
  redirect("/login");
}
