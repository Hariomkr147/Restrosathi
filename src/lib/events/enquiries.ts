import { prisma } from "../db";
import { requireUser } from "../auth/session";
import { eventEnquiryInputSchema } from "./schemas";
import { normalizePhone } from "../phone";
import { checkRate } from "../rate-limit";
import { notify } from "../whatsapp/notify";
import { sendNow } from "../whatsapp/outbox";

export async function submitEnquiry(input: any, ctx: { ip: string; now?: Date }) {
  const parsed = eventEnquiryInputSchema.parse(input);
  
  if (parsed.honeypot) {
    return { ok: true as const };
  }

  const phone = normalizePhone(parsed.phone);
  if (!phone) return { ok: false as const, error: "INVALID_PHONE" };

  const now = ctx.now ?? new Date();
  
  const dateStr = parsed.eventDate;
  const eventDate = new Date(`${dateStr}T00:00:00+05:30`);
  if (Number.isNaN(eventDate.getTime())) return { ok: false as const, error: "INVALID_DATE" };

  const todayIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  todayIST.setHours(0, 0, 0, 0);

  const maxDate = new Date(todayIST);
  maxDate.setMonth(maxDate.getMonth() + 18);

  if (eventDate < todayIST || eventDate > maxDate) {
    return { ok: false as const, error: "INVALID_DATE" };
  }

  if (!(await checkRate(`enquiry:phone:${phone}`, 3, 24 * 60 * 60 * 1000))) {
    return { ok: false as const, error: "RATE_LIMITED" };
  }
  if (!(await checkRate(`enquiry:ip:${ctx.ip}`, 5, 24 * 60 * 60 * 1000))) {
    return { ok: false as const, error: "RATE_LIMITED" };
  }

  if (parsed.packageId) {
    const pkg = await prisma.eventPackage.findUnique({ where: { id: parsed.packageId } });
    if (!pkg || !pkg.active) return { ok: false as const, error: "INVALID_PACKAGE" };
  }

  let logId = "";
  const enquiry = await prisma.$transaction(async (tx) => {
    const enq = await tx.eventEnquiry.create({
      data: {
        packageId: parsed.packageId,
        eventType: parsed.eventType,
        name: parsed.name,
        phone,
        guests: parsed.guests,
        eventDate,
        message: parsed.message,
      },
    });

    const res = await notify("EVENT_ENQUIRY_RECEIVED", phone, { name: parsed.name }, { tx });
    if ("id" in res) logId = res.id;
    return enq;
  });

  if (logId) {
    const p = sendNow(logId).catch(() => {});
    if (process.env.NODE_ENV === "test") await p;
  }
  return { ok: true as const, enquiryId: enquiry.id };
}

export async function getEnquiries() {
  await requireUser();
  return await prisma.eventEnquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: { package: true, handledBy: true }
  });
}

export async function updateEnquiryStatusAction(id: string, newStatus: "QUOTED" | "CONFIRMED" | "LOST", notes?: string, quotedPaise?: number) {
  const user = await requireUser();
  
  const enquiry = await prisma.eventEnquiry.findUnique({ where: { id } });
  if (!enquiry) return { ok: false as const, error: "NOT_FOUND" };

  const validTransitions: Record<string, string[]> = {
    NEW: ["QUOTED", "LOST"],
    QUOTED: ["CONFIRMED", "LOST"],
    CONFIRMED: [],
    LOST: [],
  };

  if (!validTransitions[enquiry.status].includes(newStatus)) {
    return { ok: false as const, error: "INVALID_TRANSITION" };
  }

  await prisma.eventEnquiry.update({
    where: { id },
    data: { 
      status: newStatus,
      notes: notes ?? undefined,
      quotedPaise: quotedPaise ?? undefined,
      handledById: user.id
    },
  });

  return { ok: true as const };
}
