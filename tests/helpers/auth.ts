import { vi } from "vitest";
import { prisma } from "../../src/lib/db";
import { createSession } from "../../src/lib/auth/session";

const jar = vi.hoisted(() => new Map<string, {
  value: string;
  options?: { httpOnly?: boolean; sameSite?: string; secure?: boolean; expires?: Date; path?: string };
}>());
export const cookieJar = jar;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options?: { httpOnly?: boolean; sameSite?: string; secure?: boolean; expires?: Date; path?: string }) => jar.set(name, { value, options }),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}));

export function mockCookies() { cookieJar.clear(); return cookieJar; }
export function asAnonymous(): void { cookieJar.clear(); }

export async function asOwner(): Promise<void> {
  cookieJar.clear();
  const user = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", active: true } });
  await createSession(user.id);
}

export async function asStaff(): Promise<void> {
  cookieJar.clear();
  const user = await prisma.user.findFirstOrThrow({ where: { role: "STAFF", active: true } });
  await createSession(user.id);
}
