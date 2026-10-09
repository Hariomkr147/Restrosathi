import { checkPreflight } from "./preflight-checks";
import { getSettings } from "../src/lib/settings";
import { prisma } from "../src/lib/db";
import { verifySecret } from "../src/lib/auth/password";

async function run() {
  const env = process.env;
  const settings = await getSettings();
  const users = await prisma.user.findMany({ where: { active: true } });
  const tables = await prisma.restaurantTable.findMany({ where: { active: true } });
  const itemCount = await prisma.menuItem.count({ where: { available: true } });
  const lastBackup = await prisma.backupRun.findFirst({
    where: { ok: true },
    orderBy: { at: "desc" }
  });

  const demoCredentialResults = await Promise.all(
    users.map(async (u) => {
      const isSeedOwner = u.passwordHash && await verifySecret(env.SEED_OWNER_PASSWORD || "restrosathi-demo", u.passwordHash);
      const isDefaultPin = u.pinHash && await verifySecret("1234", u.pinHash);
      return { id: u.id, hasDemoCredential: !!(isSeedOwner || isDefaultPin) };
    })
  );

  const snapshot = {
    env,
    settings,
    users,
    tables,
    itemCount,
    lastBackup,
    demoCredentialResults,
  };

  const results = checkPreflight(snapshot);
  
  let failed = false;
  let warnings = 0;
  for (const res of results) {
    if (res.type === "warning") {
      console.log(`[WARN] ${res.name}: ${res.error}`);
      warnings++;
    } else if (res.ok) {
      console.log(`[PASS] ${res.name}`);
    } else {
      console.log(`[FAIL] ${res.name}: ${res.error}`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log(`All preflight checks passed with ${warnings} warnings!`);
  }
}

run().catch(console.error);
