/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from "../db";
import { requireUser } from "./session";
import { hashSecret, verifySecret } from "./password";
import { randomBytes } from "node:crypto";

export async function createStaff({ name, pin }: { name: string; pin: string }) {
  const me = await requireUser("OWNER");
  
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const existing = await prisma.user.findFirst({ where: { name, active: true } });
  if (existing) {
    throw new Error("Staff name already exists");
  }

  const pinHash = await hashSecret(pin);
  const user = await prisma.user.create({
    data: {
      name,
      role: "STAFF",
      pinHash,
      active: true,
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: me.id,
      action: "account.create",
      entity: "User",
      entityId: user.id,
      data: { name }
    }
  });

  return user;
}

export async function resetStaffPin(userId: string, pin: string) {
  const me = await requireUser("OWNER");
  
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const pinHash = await hashSecret(pin);
  await prisma.user.update({
    where: { id: userId, role: "STAFF" },
    data: { pinHash }
  });

  await prisma.auditLog.create({
    data: {
      actorId: me.id,
      action: "account.pin_reset",
      entity: "User",
      entityId: userId,
      data: {}
    }
  });
}

export async function setStaffActive(userId: string, active: boolean) {
  const me = await requireUser("OWNER");
  
  await prisma.user.update({
    where: { id: userId, role: "STAFF" },
    data: { active }
  });
  
  if (!active) {
    await prisma.authSession.deleteMany({ where: { userId } });
  }

  await prisma.auditLog.create({
    data: {
      actorId: me.id,
      action: "account.active",
      entity: "User",
      entityId: userId,
      data: { active }
    }
  });
}

export async function changeOwnerPassword(current: string, next: string) {
  const user = await requireUser("OWNER");
  
  if (next.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }

  const userRecord = await prisma.user.findUnique({ where: { id: user.id } });
  if (!userRecord?.passwordHash) throw new Error("Current password not set");
  const isValid = await verifySecret(current, userRecord.passwordHash);
  if (!isValid) {
    throw new Error("Current password incorrect");
  }

  const passwordHash = await hashSecret(next);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get("rs_session")?.value;
  const { createHash } = await import("node:crypto");
  
  if (token) {
    const hash = createHash("sha256").update(token).digest("hex");
    await prisma.authSession.deleteMany({ 
      where: { 
        userId: user.id,
        tokenHash: { not: hash }
      } 
    });
  } else {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "account.password",
      entity: "User",
      entityId: user.id,
      data: {}
    }
  });
}
