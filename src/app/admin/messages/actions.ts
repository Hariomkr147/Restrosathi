"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function markHandledAction(phone: string) {
  await requireUser("STAFF");

  await prisma.$transaction(async (tx) => {
    // Clear needsHuman for all messages in this thread
    await tx.messageLog.updateMany({
      where: { phone, needsHuman: true },
      data: { needsHuman: false }
    });

    // Pause AI for 12 hours
    const pausedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await tx.threadState.upsert({
      where: { phone },
      create: { phone, aiPausedUntil: pausedUntil },
      update: { aiPausedUntil: pausedUntil }
    });
  });

  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}
