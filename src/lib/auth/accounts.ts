import { prisma } from "../db";
import { requireUser } from "./session";
import { generateHash } from "./password";
import { randomBytes } from "node:crypto";

export async function createStaff({ name, pin }: { name: string; pin: string }) {
  await requireUser("OWNER");
  
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const existing = await prisma.user.findFirst({ where: { name, active: true } });
  if (existing) {
    throw new Error("Staff name already exists");
  }

  const pinHash = await generateHash(pin);
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
      userId: user.id,
      action: "account.create",
      details: { name }
    }
  });

  return user;
}

export async function resetStaffPin(userId: string, pin: string) {
  await requireUser("OWNER");
  
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const pinHash = await generateHash(pin);
  await prisma.user.update({
    where: { id: userId, role: "STAFF" },
    data: { pinHash }
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "account.pin_reset",
      details: {}
    }
  });
}

export async function setStaffActive(userId: string, active: boolean) {
  await requireUser("OWNER");
  
  await prisma.user.update({
    where: { id: userId, role: "STAFF" },
    data: { active }
  });
  
  if (!active) {
    await prisma.authSession.deleteMany({ where: { userId } });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "account.active",
      details: { active }
    }
  });
}

export async function changeOwnerPassword(current: string, next: string) {
  const user = await requireUser("OWNER");
  
  if (next.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }

  const { verifyPassword } = await import("./password");
  const isValid = await verifyPassword(user.id, current);
  if (!isValid) {
    throw new Error("Current password incorrect");
  }

  const passwordHash = await generateHash(next);
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
      userId: user.id,
      action: "account.password",
      details: {}
    }
  });
}
