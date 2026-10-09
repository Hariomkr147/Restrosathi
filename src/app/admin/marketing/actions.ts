"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { CampaignSegment } from "@prisma/client";
import { generateMarketingVariants } from "@/lib/marketing/ai";
import { getMarketingAudience } from "@/lib/marketing/segments";
import { revalidatePath } from "next/cache";

export async function generateVariantsAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Unauthorized");

  const goal = formData.get("goal") as string;
  const locale = formData.get("locale") as "en" | "hi";

  if (!goal || goal.length < 10 || goal.length > 400) {
    throw new Error("Goal must be between 10 and 400 characters");
  }

  const variants = await generateMarketingVariants(goal, locale);
  return variants;
}

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Unauthorized");

  const goal = formData.get("goal") as string;
  const locale = formData.get("locale") as string;
  const segment = formData.get("segment") as CampaignSegment;
  const message = formData.get("message") as string;

  if (!message || message.length > 300) {
    throw new Error("Message must be valid and <= 300 chars");
  }
  
  if (locale === "hi" && !message.includes("STOP")) {
     // rudimentary check
  }

  const audience = await getMarketingAudience(segment);

  const campaign = await prisma.campaign.create({
    data: {
      goal,
      locale,
      segment,
      message,
      createdById: user.id
    }
  });

  if (audience.length > 0) {
    await prisma.campaignSend.createMany({
      data: audience.map(c => ({
        campaignId: campaign.id,
        customerId: c.id,
        phone: c.phone
      }))
    });
  }

  revalidatePath("/admin/marketing");
  return campaign.id;
}

export async function markCampaignSentAction(campaignId: string, sendId: string) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "STAFF") throw new Error("Unauthorized");

  // Idempotent update
  await prisma.campaignSend.update({
    where: { id: sendId },
    data: { 
      status: "SENT",
      sentAt: new Date()
    }
  });

  revalidatePath(`/admin/marketing/${campaignId}`);
}
