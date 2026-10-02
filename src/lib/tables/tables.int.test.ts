import { afterEach, expect, it, vi } from "vitest";
import { prisma } from "../db";
import { asAnonymous, asOwner, asStaff } from "../../../tests/helpers/auth";
import { destroySession } from "../auth/session";
import { findActiveTableByCode, listTables } from ".";
import * as actions from "../../app/admin/tables/actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
afterEach(async () => { await destroySession(); asAnonymous(); });

it("owner creates, renames, disables and regenerates with atomic audit rows", async () => {
  await asOwner();
  const created = await actions.createTable("  Test 11  ");
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("Creation failed");
  const table = created.data;
  expect(table.label).toBe("Test 11");
  expect(await findActiveTableByCode(table.code)).toMatchObject({ id: table.id });
  expect(await listTables()).toEqual(expect.arrayContaining([expect.objectContaining({ id: table.id })]));
  expect(await actions.createTable("Test 11")).toMatchObject({ ok: false, error: "LABEL_TAKEN" });
  expect(await actions.renameTable(table.id, "Renamed 11")).toMatchObject({ ok: true });
  const regenerated = await actions.regenerateTableCode(table.id);
  expect(regenerated.ok).toBe(true);
  if (!regenerated.ok) throw new Error("Regeneration failed");
  expect(regenerated.data.code).not.toBe(table.code);
  expect(await findActiveTableByCode(table.code)).toBeNull();
  expect(await findActiveTableByCode(regenerated.data.code)).toMatchObject({ label: "Renamed 11" });
  expect(await actions.setTableActive(table.id, false)).toMatchObject({ ok: true });
  expect(await findActiveTableByCode(regenerated.data.code)).toBeNull();
  expect(await actions.setTableActive(table.id, true)).toMatchObject({ ok: true });
  expect(await findActiveTableByCode(regenerated.data.code)).not.toBeNull();
  const logs = await prisma.auditLog.findMany({ where: { entityId: table.id }, orderBy: { at: "asc" } });
  expect(logs.map((log) => log.action)).toEqual(["table.create", "table.rename", "table.regenerate", "table.active", "table.active"]);
  expect(logs.every((log) => log.actorId === "owner-demo")).toBe(true);
});
it.each(["", "   ", "x".repeat(21)])("rejects invalid trimmed label %j", async (label) => {
  await asOwner();
  expect(await actions.createTable(label)).toMatchObject({ ok: false, error: "INVALID_LABEL" });
});
for (const signIn of [asAnonymous, asStaff]) {
  it(`${signIn.name}: every mutation requires owner permission`, async () => {
    await signIn();
    for (const run of [() => actions.createTable("Forbidden"), () => actions.renameTable("table-1", "Forbidden"),
      () => actions.setTableActive("table-1", false), () => actions.regenerateTableCode("table-1")]) {
      expect(await run()).toMatchObject({ ok: false, error: "FORBIDDEN" });
    }
    expect(await prisma.restaurantTable.count({ where: { label: "Forbidden" } })).toBe(0);
  });
}
it("rename cannot take another table's label and leaves no audit on failure", async () => {
  await asOwner();
  const tables = await listTables();
  const before = await prisma.auditLog.count();
  expect(await actions.renameTable(tables[0].id, tables[1].label)).toMatchObject({ ok: false, error: "LABEL_TAKEN" });
  expect(await prisma.auditLog.count()).toBe(before);
});
