import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashSecret } from "../src/lib/auth/password";

const prisma = new PrismaClient();

try {
  const ownerPassword = z.string().min(8).max(128).parse(process.env.SEED_OWNER_PASSWORD);
  const staffPin = z.string().regex(/^\d{4,6}$/).parse(process.env.SEED_STAFF_PIN);
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Saffron Tadka",
      about: {
        en: "Saffron Tadka is a fictional demo restaurant.",
        hi: "सैफ़्रन तड़का प्रदर्शन के लिए बनाया गया एक काल्पनिक रेस्तराँ है।",
      },
      address: "Demo address, India (fictional)",
      phone: "+919999900000",
      whatsappPhone: "+919999900000",
      hours: Object.fromEntries(
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, [{ open: "11:00", close: "23:00" }]]),
      ),
    },
  });
  await prisma.user.upsert({
    where: { phone: "+919999900001" }, update: {},
    create: { id: "owner-demo", name: "Owner", phone: "+919999900001", passwordHash: await hashSecret(ownerPassword), role: "OWNER" },
  });
  await prisma.user.upsert({
    where: { id: "staff-ravi" }, update: {},
    create: { id: "staff-ravi", name: "Ravi", pinHash: await hashSecret(staffPin), role: "STAFF" },
  });
} finally {
  await prisma.$disconnect();
}
