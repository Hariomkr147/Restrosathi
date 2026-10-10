import { prisma } from "../db";
import { requireUser } from "./session";
import { hashSecret, verifySecret } from "./password";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export async function createStaff({ name, pin }: { name: string; pin: string }) {
  const me = await requireUser("OWNER");
  
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const cleanName = name.trim();

  return prisma.$transaction(async (tx) => {
    const hash = crypto.createHash('md5').update(cleanName).digest();
    const lockKey = hash.readInt32BE(0);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(506, ${lockKey}::int)`;
    
    const existing = await tx.user.findFirst({
      where: { name: cleanName, active: true, role: "STAFF" }
    });
    if (existing) {
      throw new Error("An active staff member with this name already exists");
    }

    const pinHash = await hashSecret(pin);
    const user = await tx.user.create({
      data: {
        name: cleanName,
        role: "STAFF",
        pinHash,
        active: true,
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: me.id,
        action: "account.create",
        entity: "User",
        entityId: user.id,
        data: { name: cleanName }
      }
    });
    
    return user;
  });
}

export async function resetStaffPin(userId: string, pin: string) {
  const me = await requireUser("OWNER");
  
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  await prisma.$transaction(async (tx) => {
    const pinHash = await hashSecret(pin);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "STAFF") throw new Error("Staff not found");

    await tx.user.update({
      where: { id: userId },
      data: { pinHash }
    });

    await tx.auditLog.create({
      data: {
        actorId: me.id,
        action: "account.pin_reset",
        entity: "User",
        entityId: userId,
        data: {}
      }
    });
  });
}

export async function setStaffActive(userId: string, active: boolean) {
  const me = await requireUser("OWNER");
  
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "STAFF") throw new Error("Staff not found");

    if (active) {
      const hash = crypto.createHash('md5').update(user.name).digest();
      const lockKey = hash.readInt32BE(0);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(506, ${lockKey}::int)`;
      
      const existing = await tx.user.findFirst({
        where: { name: user.name, active: true, role: "STAFF" }
      });
      
      if (existing && existing.id !== userId) {
        throw new Error("Another active staff member has this name. Please rename them first.");
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { active }
    });
    
    if (!active) {
      await tx.authSession.deleteMany({ where: { userId } });
    }

    await tx.auditLog.create({
      data: {
        actorId: me.id,
        action: "account.active",
        entity: "User",
        entityId: userId,
        data: { active }
      }
    });
  });
}

export async function changeOwnerPassword(current: string, next: string) {
  const user = await requireUser("OWNER");
  
  if (next.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }

  await prisma.$transaction(async (tx) => {
    const userRecord = await tx.user.findUnique({ where: { id: user.id } });
    if (!userRecord?.passwordHash) throw new Error("Current password not set");
    
    const isValid = await verifySecret(current, userRecord.passwordHash);
    if (!isValid) {
      throw new Error("Current password incorrect");
    }

    const passwordHash = await hashSecret(next);
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    const store = await cookies();
    const token = store.get("rs_session")?.value;
    
    if (token) {
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      await tx.authSession.deleteMany({ 
        where: { 
          userId: user.id,
          tokenHash: { not: hash }
        } 
      });
    } else {
      await tx.authSession.deleteMany({ where: { userId: user.id } });
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "account.password",
        entity: "User",
        entityId: user.id,
        data: {}
      }
    });
  });
}
