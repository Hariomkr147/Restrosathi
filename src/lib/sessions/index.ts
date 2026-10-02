import type { DiningSession, Prisma } from "@prisma/client";

export async function lockTable(tx: Prisma.TransactionClient, tableId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('table:' || ${tableId}, 0))`;
}

export async function lockSession(tx: Prisma.TransactionClient, session: Pick<DiningSession, "id" | "kind" | "tableId">) {
  if (session.kind === "DINE_IN" && session.tableId) {
    await lockTable(tx, session.tableId);
  } else {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('session:' || ${session.id}, 0))`;
  }
}

export async function getOrOpenTableSession(tx: Prisma.TransactionClient, tableId: string): Promise<DiningSession> {
  await lockTable(tx, tableId);
  return await tx.diningSession.findFirst({ where: { tableId, status: { not: "CLOSED" } } }) ??
    tx.diningSession.create({ data: { kind: "DINE_IN", tableId } });
}

export function openTakeawaySession(tx: Prisma.TransactionClient, data: { customerName?: string }): Promise<DiningSession> {
  return tx.diningSession.create({ data: { kind: "TAKEAWAY", customerName: data.customerName } });
}

export async function markBillRequested(tx: Prisma.TransactionClient, sessionId: string) {
  const session = await tx.diningSession.findUniqueOrThrow({ where: { id: sessionId } });
  await lockSession(tx, session);
  await tx.diningSession.updateMany({ where: { id: sessionId, status: "OPEN" }, data: { status: "BILL_REQUESTED" } });
}

export async function closeSession(tx: Prisma.TransactionClient, sessionId: string) {
  const session = await tx.diningSession.findUniqueOrThrow({ where: { id: sessionId } });
  await lockSession(tx, session);
  await tx.diningSession.updateMany({ where: { id: sessionId, status: { not: "CLOSED" } }, data: { status: "CLOSED", closedAt: new Date() } });
}
