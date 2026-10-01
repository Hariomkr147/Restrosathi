import { expect, it } from "vitest";
import { prisma } from "../db";
import { audit } from "./index";

it("writes an audit row", async () => {
  await audit({ actorId: null, action: "test.action", entity: "Settings", entityId: "1", data: { a: 1 } });
  const row = await prisma.auditLog.findFirst({ where: { action: "test.action" } });
  expect(row?.data).toEqual({ a: 1 });
});
