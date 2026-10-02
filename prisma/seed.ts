import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashSecret } from "../src/lib/auth/password";
import { itemInputSchema, type ItemInput } from "../src/lib/menu/schemas";
import { generateTableCode } from "../src/lib/tables/code";

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

  for (let index = 1; index <= 8; index++) {
    const label = `T${index}`;
    await prisma.restaurantTable.upsert({ where: { label }, update: {}, create: {
      id: `table-${index}`, label, sortOrder: index - 1,
      code: process.env.NODE_ENV === "production" ? generateTableCode() : `TESTCODE0${index}`,
    } });
  }

  // Fictional demo menu, including missing and long Hindi text for layout checks.
  const categories = [
    { id: "starters", name: { en: "Starters", hi: "शुरुआती व्यंजन" } },
    { id: "main-course", name: { en: "Main Course", hi: "मुख्य व्यंजन" } },
    { id: "breads", name: { en: "Breads", hi: "रोटी और नान" } },
    { id: "rice", name: { en: "Rice", hi: "चावल" } },
    { id: "desserts", name: { en: "Desserts", hi: "मिठाइयाँ" } },
    { id: "beverages", name: { en: "Beverages", hi: "पेय" } },
  ];
  for (const [sortOrder, category] of categories.entries()) {
    await prisma.category.upsert({ where: { id: category.id }, update: {}, create: { ...category, sortOrder } });
  }
  const dishes: (Partial<ItemInput> & Pick<ItemInput, "categoryId" | "name" | "isVeg"> & { id: string })[] = [
    {
      id: "paneer-tikka", categoryId: "starters", name: { en: "Paneer Tikka", hi: "पनीर टिक्का" }, isVeg: true,
      basePricePaise: 28000, spiceLevel: 2, tags: ["CHEFS_SPECIAL"],
      modifierGroups: [{ name: { en: "Spice", hi: "तीखापन" }, min: 1, max: 1, options: [
        { name: { en: "Mild", hi: "कम तीखा" }, priceDeltaPaise: 0 }, { name: { en: "Hot", hi: "ज़्यादा तीखा" }, priceDeltaPaise: 0 },
      ] }],
    },
    { id: "samosa", categoryId: "starters", name: { en: "Samosa", hi: "समोसा" }, isVeg: true, basePricePaise: 8000, spiceLevel: 1 },
    { id: "hara-bhara-kebab", categoryId: "starters", name: { en: "Hara Bhara Kebab", hi: "हरा भरा कबाब" }, isVeg: true, basePricePaise: 22000 },
    { id: "chicken-tikka", categoryId: "starters", name: { en: "Chicken Tikka", hi: "चिकन टिक्का" }, isVeg: false, basePricePaise: 32000, spiceLevel: 2 },
    {
      id: "dal-makhani", categoryId: "main-course", name: { en: "Dal Makhani", hi: "दाल मखनी" }, isVeg: true, tags: ["BESTSELLER", "CHEFS_SPECIAL"],
      variants: [{ name: { en: "Half", hi: "आधा" }, pricePaise: 18000 }, { name: { en: "Full", hi: "पूरा" }, pricePaise: 32000 }],
    },
    { id: "butter-chicken", categoryId: "main-course", name: { en: "Butter Chicken", hi: "बटर चिकन" }, isVeg: false, basePricePaise: 36000, spiceLevel: 1, tags: ["CHEFS_SPECIAL"] },
    { id: "mutton-rogan-josh", categoryId: "main-course", name: { en: "Mutton Rogan Josh", hi: "मटन रोगन जोश" }, isVeg: false, basePricePaise: 42000, spiceLevel: 3, available: false },
    { id: "palak-paneer", categoryId: "main-course", name: { en: "Palak Paneer", hi: "पालक पनीर" }, isVeg: true, basePricePaise: 26000 },
    { id: "chana-masala", categoryId: "main-course", name: { en: "Chana Masala", hi: "चना मसाला" }, isVeg: true, basePricePaise: 22000, spiceLevel: 2 },
    {
      id: "butter-naan", categoryId: "breads", name: { en: "Butter Naan", hi: "बटर नान" }, isVeg: true, basePricePaise: 6000,
      modifierGroups: [{ name: { en: "Extras", hi: "अतिरिक्त विकल्प" }, min: 0, max: 2, options: [
        { name: { en: "Butter", hi: "मक्खन" }, priceDeltaPaise: 1000 }, { name: { en: "Cheese", hi: "चीज़" }, priceDeltaPaise: 3000 },
      ] }],
    },
    { id: "tandoori-roti", categoryId: "breads", name: { en: "Tandoori Roti", hi: "तंदूरी रोटी" }, isVeg: true, basePricePaise: 4000 },
    { id: "garlic-naan", categoryId: "breads", name: { en: "Garlic Naan", hi: "लहसुन नान" }, isVeg: true, basePricePaise: 8000 },
    { id: "jeera-rice", categoryId: "rice", name: { en: "Jeera Rice", hi: "जीरा चावल" }, isVeg: true, basePricePaise: 16000 },
    { id: "vegetable-biryani", categoryId: "rice", name: { en: "Vegetable Biryani", hi: "ताज़ी सब्ज़ियों और सुगंधित मसालों से बनी विशेष दम बिरयानी" }, isVeg: true, basePricePaise: 24000, spiceLevel: 2, tags: ["NEW"] },
    { id: "gulab-jamun", categoryId: "desserts", name: { en: "Gulab Jamun", hi: "गुलाब जामुन" }, isVeg: true, basePricePaise: 10000 },
    { id: "rasmalai", categoryId: "desserts", name: { en: "Rasmalai", hi: "रसमलाई" }, isVeg: true, basePricePaise: 14000 },
    { id: "kulfi", categoryId: "desserts", name: { en: "Kulfi" }, isVeg: true, basePricePaise: 10000 },
    { id: "masala-chai", categoryId: "beverages", name: { en: "Masala Chai", hi: "मसाला चाय" }, isVeg: true, basePricePaise: 6000 },
    { id: "sweet-lassi", categoryId: "beverages", name: { en: "Sweet Lassi", hi: "मीठी लस्सी" }, isVeg: true, basePricePaise: 10000 },
    { id: "nimbu-pani", categoryId: "beverages", name: { en: "Nimbu Pani", hi: "नींबू पानी" }, isVeg: true, basePricePaise: 8000 },
  ];
  for (const [sortOrder, dish] of dishes.entries()) {
    const { variants, modifierGroups, ...input } = itemInputSchema.parse({
      variants: [], modifierGroups: [], spiceLevel: 0, tags: [], available: true, ...dish,
    });
    await prisma.menuItem.upsert({
      where: { id: dish.id }, update: {}, create: {
        ...input, id: dish.id, sortOrder,
        variants: { create: variants.map((variant, index) => ({ ...variant, id: `${dish.id}-variant-${index}`, sortOrder: index })) },
        modifierGroups: { create: modifierGroups.map(({ options, ...group }, index) => ({
          ...group, id: `${dish.id}-group-${index}`, sortOrder: index,
          options: { create: options.map((option, optionIndex) => ({ ...option, id: `${dish.id}-group-${index}-option-${optionIndex}`, sortOrder: optionIndex })) },
        })) },
      },
    });
  }
} finally {
  await prisma.$disconnect();
}
