import { PrismaClient } from "@prisma/client";

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/restrosathi_test") throw new Error("E2E helpers require restrosathi_test.");
export const db = new PrismaClient({ datasourceUrl: url });
export const TABLE_CODES = Array.from({ length: 8 }, (_, index) => `TESTCODE0${index + 1}`);
export async function resetOperationalData() {
  await db.$transaction([
    db.billLine.deleteMany(), db.bill.deleteMany(), db.orderLine.deleteMany(), db.order.deleteMany(), db.serviceRequest.deleteMany(), db.diningSession.deleteMany(), db.rateHit.deleteMany(), db.loginAttempt.deleteMany(),
  ]);
}
export async function markSoldOut(itemId: string) { await db.menuItem.update({ where: { id: itemId }, data: { available: false } }); }
export async function createLongHindiItem() {
  const id = "e2e-long-hindi";
  return db.menuItem.upsert({ where: { id }, update: {}, create: {
    id, categoryId: "starters", name: { en: "Long Hindi test dish", hi: "ताज़ी सब्ज़ियों और सुगंधित मसालों से बना विशेष व्यंजन" }, isVeg: true, basePricePaise: 10000,
  } });
}
export async function createOrderableItem() {
  const id = "e2e-orderable-item";
  return db.menuItem.upsert({ where: { id }, update: {}, create: {
    id, categoryId: "starters", name: { en: "Demo platter", hi: "प्रदर्शन थाली" }, isVeg: true,
    pairings: { create: { pairedItemId: "samosa" } },
    variants: { create: [{ id: `${id}-full`, name: { en: "Full", hi: "पूरा" }, pricePaise: 25000 }] },
    modifierGroups: { create: { id: `${id}-extras`, name: { en: "Extras", hi: "अतिरिक्त" }, min: 1, max: 1,
      options: { create: { id: `${id}-cheese`, name: { en: "Cheese", hi: "चीज़" }, priceDeltaPaise: 3000 } } } },
  } });
}
