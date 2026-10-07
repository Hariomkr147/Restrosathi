import { checkPreflight } from "./preflight-checks";
import { getSettings } from "../src/lib/settings";
import { prisma } from "../src/lib/db";

async function run() {
  const env = process.env;
  const settings = await getSettings();
  const users = await prisma.user.findMany({ where: { active: true } });
  const tables = await prisma.restaurantTable.findMany({ where: { active: true } });
  const itemCount = await prisma.menuItem.count();
  const lastBackup = await prisma.backupRun.findFirst({
    where: { ok: true },
    orderBy: { at: "desc" }
  });

  const snapshot = {
    env,
    settings,
    users,
    tables,
    itemCount,
    lastBackup,
  };

  const results = checkPreflight(snapshot);
  
  let failed = false;
  for (const res of results) {
    if (res.ok) {
      console.log(`[PASS] ${res.name}`);
    } else {
      console.log(`[FAIL] ${res.name}: ${res.error}`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log("All preflight checks passed!");
  }
}

run().catch(console.error);
