import { execFileSync } from "node:child_process";

export default function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || new URL(testUrl).pathname !== "/restrosathi_test" || testUrl === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must point to the separate restrosathi_test database.");
  }
  const env = { ...process.env, DATABASE_URL: testUrl };
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"], { env, stdio: "inherit" });
  execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env, stdio: "inherit" });
}
