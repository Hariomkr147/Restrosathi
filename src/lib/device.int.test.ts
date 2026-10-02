import { beforeEach, expect, it } from "vitest";
import { cookieJar, mockCookies } from "../../tests/helpers/auth";
import { getDeviceId } from "./device";

beforeEach(() => { mockCookies(); });
it("creates and retains a random 128-bit httpOnly device cookie for 400 days", async () => {
  const start = Date.now(); const id = await getDeviceId();
  expect(id).toMatch(/^[a-f0-9]{32}$/);
  expect(await getDeviceId()).toBe(id);
  const cookie = cookieJar.get("rs_device");
  expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  expect(cookie?.options?.expires?.getTime()).toBeGreaterThanOrEqual(start + 400 * 86_400_000);
});
it("replaces malformed client cookie values", async () => {
  cookieJar.set("rs_device", { value: "unbounded-or-forged-device" });
  expect(await getDeviceId()).toMatch(/^[a-f0-9]{32}$/);
});
