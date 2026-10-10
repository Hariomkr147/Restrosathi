 
import { prisma } from "../db";
import { formatINR } from "../money/format";
import { Hours } from "../settings/schema";

export async function buildFacts() {
  const settings = await prisma.settings.findFirst();
  const phone = settings?.phone || "Restaurant Phone";
  const address = settings?.address || "Restaurant Address";
  const name = settings?.name || "Restaurant Name";

  // Today's opening hours
  const now = new Date();
  const offsetIST = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + offsetIST);
  const dayIndex = istDate.getUTCDay();
  const dayNames: (keyof Hours)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = dayNames[dayIndex];
  
  let hoursText = "Closed today";
  if (settings?.hours) {
    const hours = settings.hours as unknown as Hours;
    const shifts = hours[dayKey];
    if (shifts && shifts.length > 0) {
      hoursText = shifts.map(s => `${s.open} to ${s.close}`).join(", ");
    }
  }

  // Active menu items
  const menuItems = await prisma.menuItem.findMany({
    where: { available: true },
    select: { name: true, basePricePaise: true, isVeg: true },
  });

  const menuText = menuItems.map(item => {
    const nameObj = item.name as Record<string, string> | null;
    const nameEn = nameObj?.en || "Unknown";
    const nameHi = nameObj?.hi || "";
    const price = item.basePricePaise ? formatINR(item.basePricePaise) : "Variable";
    const vegStr = item.isVeg ? "(Veg)" : "(Non-veg)";
    return `- ${nameEn} ${nameHi ? `(${nameHi})` : ""} ${vegStr}: ${price}`;
  }).join("\n");

  const APP_URL = process.env.APP_URL || "http://localhost:3000";

  return `
Restaurant Name: ${name}
Address: ${address}
Phone: ${phone}
Today's Hours: ${hoursText}
Booking Link: ${APP_URL}/book
Events Link: ${APP_URL}/events

Available Menu:
${menuText || "Menu is empty"}
`.trim();
}
