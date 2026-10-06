import { PrismaClient } from "@prisma/client";
import { bookableSlots } from "./src/lib/bookings/slots";

async function main() {
  const prisma = new PrismaClient();
  const settings = await prisma.settings.findFirst();
  
  const tmr = new Date();
  tmr.setDate(tmr.getDate() + 1);
  const dateStr = tmr.toISOString().slice(0, 10);
  
  console.log("dateStr", dateStr);
  console.log("nowMs", Date.now());
  const slots = bookableSlots(dateStr, settings!.hours as any, Date.now(), settings!, []);
  console.log("slots length", slots.length);
  if (slots.length > 0) {
    console.log("first slot", slots[0]);
  }
}

main().catch(console.error);
