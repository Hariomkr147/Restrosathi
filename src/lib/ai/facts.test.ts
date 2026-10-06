import { expect, test, beforeEach } from "vitest";
import { prisma } from "../db";
import { buildFacts } from "./facts";

beforeEach(async () => {
  await prisma.menuItem.deleteMany({});
  await prisma.settings.deleteMany({});
});

test("buildFacts includes restaurant info and available menu, excludes sold-out", async () => {
  await prisma.settings.create({
    data: {
      name: "Saffron Tadka",
      address: "123 Spice Road",
      phone: "+919876543210",
      whatsappPhone: "+919876543210",
      hours: {
        mon: [{ open: "10:00", close: "23:00" }],
        tue: [{ open: "10:00", close: "23:00" }],
        wed: [{ open: "10:00", close: "23:00" }],
        thu: [{ open: "10:00", close: "23:00" }],
        fri: [{ open: "10:00", close: "23:00" }],
        sat: [{ open: "10:00", close: "23:00" }],
        sun: [{ open: "10:00", close: "23:00" }]
      },
      about: { en: "Test" },
      taxMode: "NONE",
      gstRatePercent: 5,
      pricesIncludeTax: true
    }
  });

  const category = await prisma.category.create({
    data: { name: { en: "Test" } }
  });

  await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: { en: "Butter Chicken", hi: "बटर चिकन" },
      basePricePaise: 40000,
      isVeg: false,
      available: true
    }
  });

  await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: { en: "Sold Out Dal", hi: "दाल" },
      basePricePaise: 20000,
      isVeg: true,
      available: false
    }
  });

  const facts = await buildFacts();
  expect(facts).toContain("Saffron Tadka");
  expect(facts).toContain("123 Spice Road");
  expect(facts).toContain("10:00 to 23:00");
  expect(facts).toContain("Butter Chicken");
  expect(facts).toContain("400.00");
  expect(facts).not.toContain("Sold Out Dal");
});
