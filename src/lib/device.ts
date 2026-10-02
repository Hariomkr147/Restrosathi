import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export async function getDeviceId(): Promise<string> {
  const jar = await cookies();
  const current = jar.get("rs_device")?.value;
  if (current && /^[a-f0-9]{32}$/.test(current)) return current;
  const id = randomBytes(16).toString("hex");
  jar.set("rs_device", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: new Date(Date.now() + 400 * 86_400_000) });
  return id;
}
