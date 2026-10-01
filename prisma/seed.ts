import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
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
} finally {
  await prisma.$disconnect();
}
