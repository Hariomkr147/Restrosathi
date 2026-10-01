import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";

export type CurrentUser = { id: string; name: string; role: "OWNER" | "STAFF" };
export class AuthError extends Error {
  constructor() { super("Authentication or owner permission is required."); this.name = "AuthError"; }
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60_000);
  await prisma.authSession.create({ data: { tokenHash: tokenHash(token), userId, expiresAt } });
  (await cookies()).set("rs_session", token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get("rs_session")?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await prisma.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  const { id, name, role } = session.user;
  return { id, name, role };
}

export async function requireUser(role?: "OWNER" | "STAFF"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || (role === "OWNER" && user.role !== "OWNER")) throw new AuthError();
  return user;
}

export async function requirePageUser(role?: "OWNER" | "STAFF"): Promise<CurrentUser> {
  try { return await requireUser(role); }
  catch (error) { if (error instanceof AuthError) redirect("/login"); throw error; }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get("rs_session")?.value;
  if (token) await prisma.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.delete("rs_session");
}

export async function getActiveStaff(): Promise<{ id: string; name: string }[]> {
  return prisma.user.findMany({ where: { role: "STAFF", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
