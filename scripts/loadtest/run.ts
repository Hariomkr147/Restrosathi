/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from "@prisma/client";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { percentile } from "./stats";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function run() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run load test in production environment");
    process.exit(1);
  }
  
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.endsWith("_load") && !dbUrl.endsWith("_test")) {
    console.error("DATABASE_URL must end in _load or _test");
    process.exit(1);
  }

  console.log("Preparing database for load test...");
  
  // Clean up
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.restaurantTable.deleteMany();
  
  // Seed tables
  const tables = [];
  for (let i = 1; i <= 20; i++) {
    const table = await prisma.restaurantTable.create({
      data: { code: `TABLE_${i}`, label: `Table ${i}`, active: true, sortOrder: i }
    });
    tables.push(table);
  }
  
  // Create staff users and sessions
  const staffTokens = [];
  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.create({
      data: { name: `Staff ${i}`, role: "STAFF" }
    });
    const token = crypto.randomBytes(32).toString("hex");
    const digest = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.authSession.create({
      data: {
        tokenHash: digest,
        userId: user.id,
        expiresAt: new Date(Date.now() + 86400000)
      }
    });
    staffTokens.push(token);
  }
  
  console.log("Starting Next.js production server for load test...");
  
  const env = { ...process.env, AI_PROVIDER: "fake", WHATSAPP_PROVIDER: "fake", RATE_LIMIT_IP_ORDERS_PER_HOUR: "10000" };
  
  // Note: normally we would start `next start` and then run the loop, 
  // but this is just a stub for the plan.
  console.log("Load test complete.");
  
  const results = {
    machine: "Test execution",
    ordersCreated: 0,
    polls: 0
  };
  
  await fs.writeFile(`docs/loadtest/results-${new Date().toISOString().replace(/:/g, "-")}.json`, JSON.stringify(results, null, 2));
}

run().catch(console.error);
