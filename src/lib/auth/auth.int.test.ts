import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { asAnonymous, asOwner, asStaff, cookieJar, mockCookies } from "../../../tests/helpers/auth";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { isLockedOut, recordFailure } from "./rate-limit";
import { AuthError, createSession, destroySession, getCurrentUser, requireUser } from "./session";
import { loginWithPassword, loginWithPin, logout } from "../../app/login/actions";

beforeEach(async () => {
  mockCookies();
  await prisma.loginAttempt.deleteMany();
});
afterEach(() => vi.unstubAllEnvs());

it("locks the IP key even when the account has no failures", async () => {
  for (let i = 0; i < 5; i++) await recordFailure(["ip:127.0.0.1"]);
  expect(await loginWithPassword({ phone: "+919999900001", password: process.env.SEED_OWNER_PASSWORD! })).toEqual({ error: "locked" });
});

it("sets secure cookies in production and rejects anonymous logout", async () => {
  await expect(logout()).rejects.toBeInstanceOf(AuthError);
  vi.stubEnv("NODE_ENV", "production");
  await asOwner();
  expect(cookieJar.get("rs_session")?.options?.secure).toBe(true);
});

it("locks out after 5 failures even with the right password next", async () => {
  for (let i = 0; i < 5; i++) await recordFailure(["user:owner-test"]);
  expect(await isLockedOut(["user:owner-test"])).toBe(true);
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  for (let i = 0; i < 5; i++) await recordFailure([`user:${owner.id}`]);
  expect(await loginWithPassword({ phone: owner.phone!, password: process.env.SEED_OWNER_PASSWORD! })).toEqual({ error: "locked" });
  expect(cookieJar.has("rs_session")).toBe(false);
});

it("keeps a triggered lockout for 15 minutes", async () => {
  await prisma.loginAttempt.createMany({ data: [0, 1, 2, 3].map(() => ({ key: "user:spread", at: new Date(Date.now() - 20 * 60_000) })) });
  await prisma.loginAttempt.create({ data: { key: "user:spread", at: new Date(Date.now() - 10 * 60_000) } });
  expect(await isLockedOut(["user:spread"])).toBe(true);
});

it("permits attempts again after the lockout ends", async () => {
  await prisma.loginAttempt.createMany({ data: Array.from({ length: 5 }, () => ({ key: "user:old", at: new Date(Date.now() - 16 * 60_000) })) });
  expect(await isLockedOut(["user:old"])).toBe(false);
});

it("treats an expired session as logged out", async () => {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  const token = Buffer.alloc(32, 1).toString("base64url");
  await prisma.authSession.create({ data: { userId: owner.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() - 1) } });
  cookieJar.set("rs_session", { value: token });
  expect(await getCurrentUser()).toBeNull();
});

it("requireUser('OWNER') rejects staff", async () => {
  await asStaff();
  await expect(requireUser("OWNER")).rejects.toBeInstanceOf(AuthError);
  expect((await requireUser("STAFF")).name).toBe("Ravi");
});

it("rejects missing and unknown sessions", async () => {
  asAnonymous();
  expect(await getCurrentUser()).toBeNull();
  await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  cookieJar.set("rs_session", { value: Buffer.alloc(32, 2).toString("base64url") });
  expect(await getCurrentUser()).toBeNull();
});

it("stores only a token hash and sets a 12-hour httpOnly session cookie", async () => {
  const started = Date.now();
  await asOwner();
  const cookie = cookieJar.get("rs_session")!;
  expect(Buffer.from(cookie.value, "base64url")).toHaveLength(32);
  expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  const row = await prisma.authSession.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(cookie.value).digest("hex") } });
  expect(row.tokenHash).not.toBe(cookie.value);
  expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(started + 12 * 60 * 60_000);
  expect(cookie.options?.expires).toEqual(row.expiresAt);
  expect((await requireUser("STAFF")).role).toBe("OWNER");
});

it("rejects a session belonging to an inactive user", async () => {
  const user = await prisma.user.create({ data: { name: "Inactive test", role: "STAFF", active: false } });
  await createSession(user.id);
  expect(await getCurrentUser()).toBeNull();
});

it("removes the session and cookie on logout", async () => {
  await asOwner();
  const token = cookieJar.get("rs_session")!.value;
  await destroySession();
  expect(cookieJar.has("rs_session")).toBe(false);
  expect(await prisma.authSession.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } })).toBeNull();
});

it("a PIN cannot log in an owner and malformed login inputs fail", async () => {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  expect(await loginWithPin({ userId: owner.id, pin: "1234" })).toEqual({ error: "invalid" });
  expect(await loginWithPassword({ phone: "invalid", password: "" })).toEqual({ error: "invalid" });
  expect(await loginWithPin({ userId: "missing", pin: "abc" })).toEqual({ error: "invalid" });
});
