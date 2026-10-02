import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { prisma } from "../db";
import { getOrOpenTableSession, openTakeawaySession, markBillRequested, closeSession } from ".";

const tableId = "session-test-table";
const options = { maxWait: 20_000, timeout: 30_000 };
const takeawayIds: string[] = [];
beforeAll(async () => { await prisma.restaurantTable.create({ data: { id: tableId, label: "Session test", code: "SESSION234", sortOrder: 999 } }); });
beforeEach(async () => { await prisma.diningSession.deleteMany({ where: { tableId } }); });
afterAll(async () => {
  await prisma.diningSession.deleteMany({ where: { OR: [{ tableId }, { id: { in: takeawayIds } }] } });
  await prisma.restaurantTable.delete({ where: { id: tableId } });
});

it("joins the same non-closed table session in sequence", async () => {
  const first = await prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options);
  const next = await prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options);
  expect(next.id).toBe(first.id);
  expect(next).toMatchObject({ kind: "DINE_IN", status: "OPEN", tableId });
});
it("ten concurrent callers open exactly one session, across three loops", async () => {
  for (let loop = 0; loop < 3; loop++) {
    await prisma.diningSession.deleteMany({ where: { tableId } });
    const sessions = await Promise.all(Array.from({ length: 10 }, () =>
      prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options)));
    expect(new Set(sessions.map((session) => session.id)).size).toBe(1);
    expect(await prisma.diningSession.count({ where: { tableId, status: { not: "CLOSED" } } })).toBe(1);
  }
});
it("closing records a timestamp and lets the next order open a new session", async () => {
  const first = await prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options);
  await prisma.$transaction((tx) => closeSession(tx, first.id), options);
  const closed = await prisma.diningSession.findUniqueOrThrow({ where: { id: first.id } });
  expect(closed.status).toBe("CLOSED"); expect(closed.closedAt).toBeInstanceOf(Date);
  const next = await prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options);
  expect(next.id).not.toBe(first.id);
});
it("bill-requested is still the table's active session; a closed session stays closed", async () => {
  const first = await prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options);
  await prisma.$transaction((tx) => markBillRequested(tx, first.id), options);
  expect(await prisma.$transaction((tx) => getOrOpenTableSession(tx, tableId), options)).toMatchObject({ id: first.id, status: "BILL_REQUESTED" });
  await prisma.$transaction((tx) => closeSession(tx, first.id), options);
  await prisma.$transaction((tx) => markBillRequested(tx, first.id), options);
  expect(await prisma.diningSession.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: "CLOSED", closedAt: expect.any(Date) });
});
it("allows three simultaneous takeaway sessions", async () => {
  const sessions = await Promise.all(Array.from({ length: 3 }, (_, index) =>
    prisma.$transaction((tx) => openTakeawaySession(tx, { customerName: `Guest ${index}` }), options)));
  takeawayIds.push(...sessions.map((session) => session.id));
  expect(new Set(sessions.map((session) => session.id)).size).toBe(3);
  for (const session of sessions) expect(session).toMatchObject({ kind: "TAKEAWAY", tableId: null, status: "OPEN" });
});
it("database rejects a dine-in row without a table", async () => {
  await expect(prisma.diningSession.create({ data: { kind: "DINE_IN" } })).rejects.toThrow();
});
it("database backstop rejects another live session when the helper is bypassed", async () => {
  await prisma.diningSession.create({ data: { kind: "DINE_IN", tableId, status: "BILL_REQUESTED" } });
  await expect(prisma.diningSession.create({ data: { kind: "DINE_IN", tableId } })).rejects.toThrow();
});
it("real migrations install the partial unique index", async () => {
  const rows = await prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'DiningSession_one_active_per_table'`;
  expect(rows).toEqual([{ indexname: "DiningSession_one_active_per_table" }]);
});
