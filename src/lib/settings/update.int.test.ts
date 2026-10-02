import { beforeEach, expect, it } from "vitest";
import { asAnonymous, asOwner, asStaff } from "../../../tests/helpers/auth";
import { AuthError } from "../auth/session";
import { prisma } from "../db";
import { getSettings, updateSettings } from "./index";

beforeEach(async () => { asAnonymous(); await prisma.auditLog.deleteMany({ where: { action: "settings.update" } }); });

it("staff cannot change settings", async () => {
  await asStaff();
  await expect(updateSettings(await getSettings())).rejects.toBeInstanceOf(AuthError);
});
it("anonymous cannot change settings", async () => {
  await expect(updateSettings(await getSettings())).rejects.toBeInstanceOf(AuthError);
});
it("owner input persists and creates exactly one audit with before and after", async () => {
  await asOwner();
  const before = await getSettings();
  try {
    expect(await updateSettings({ ...before, name: "Demo settings test" })).toEqual({ ok: true });
    expect((await getSettings()).name).toBe("Demo settings test");
    const rows = await prisma.auditLog.findMany({ where: { action: "settings.update" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({ before: { name: before.name }, after: { name: "Demo settings test" } });
    expect(rows[0].actorId).toBeTruthy();
  } finally { await updateSettings(before); }
});
it("invalid hours return an hours error without changing data or auditing", async () => {
  await asOwner();
  const before = await getSettings();
  const result = await updateSettings({ ...before, hours: { ...before.hours, mon: [{ open: "25:00", close: "23:00" }] } });
  expect(result).toMatchObject({ ok: false, fieldErrors: { hours: expect.any(Array) } });
  expect(await getSettings()).toEqual(before);
  expect(await prisma.auditLog.count({ where: { action: "settings.update" } })).toBe(0);
});
it("overnight hours save", async () => {
  await asOwner();
  const before = await getSettings();
  try {
    expect(await updateSettings({ ...before, hours: { ...before.hours, mon: [{ open: "18:00", close: "01:00" }] } })).toEqual({ ok: true });
    expect((await getSettings()).hours.mon).toEqual([{ open: "18:00", close: "01:00" }]);
  } finally { await updateSettings(before); }
});
it("rejects invalid contact details, unsafe links and an overlong name", async () => {
  await asOwner();
  const before = await getSettings();
  for (const change of [{ phone: "9876543210" }, { whatsappPhone: "+91123" }, { mapEmbedUrl: "not a URL" }, { mapEmbedUrl: "javascript:alert(1)" }, { googleReviewUrl: "http://example.com" }, { name: "x".repeat(81) }]) {
    expect(await updateSettings({ ...before, ...change })).toMatchObject({ ok: false });
  }
  expect(await getSettings()).toEqual(before);
});
