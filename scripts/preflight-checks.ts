/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
export function checkPreflight(snapshot: any) {
  const results: { name: string, ok: boolean, error: string | null }[] = [];
  
  const assert = (name: string, condition: boolean, error: string) => {
    results.push({ name, ok: condition, error: condition ? null : error });
  };

  const { env, settings, users, tables, itemCount, lastBackup } = snapshot;

  assert("Environment is production", env.NODE_ENV === "production", "NODE_ENV is not production");
  assert("App URL is secure", (env.APP_URL || "").startsWith("https://"), "APP_URL does not start with https://");
  
  const secrets = ["CRON_SECRET", "OTP_SECRET", "COOKIE_SECRET", "WA_WEBHOOK_SECRET"];
  for (const secret of secrets) {
    const val = env[secret] || "";
    assert(`Secret ${secret} valid`, val.length >= 32 && !val.includes("example"), `${secret} is short or example`);
  }

  assert("Backup encryption key valid", Buffer.from(env.BACKUP_ENCRYPTION_KEY || "", "base64").length === 32, "BACKUP_ENCRYPTION_KEY must be 32 bytes");
  
  assert("No null passwords", !users.some((u: any) => !u.passwordHash && !u.pinHash), "A user has no password/pin hash");
  
  // demo check simplified
  
  assert("Settings name is not demo", settings.name !== "Saffron Tadka" || env.ALLOW_DEMO_NAME === "1", "Restaurant name is the demo name");
  assert("Tax mode confirmed", settings.taxModeConfirmedAt != null, "Tax mode not confirmed");
  if (settings.taxMode === "REGULAR") {
    assert("GSTIN provided", !!settings.gstin, "REGULAR tax mode requires GSTIN");
  }

  assert("Real WhatsApp provider", env.WHATSAPP_PROVIDER !== "fake", "WHATSAPP_PROVIDER is fake");
  
  assert("Tables exist", tables.length > 0, "No active tables");
  assert("Menu items exist", itemCount >= 5, "Fewer than 5 menu items");

  const oneDayAgo = Date.now() - 26 * 60 * 60 * 1000;
  assert("Recent backup", lastBackup && lastBackup.at.getTime() > oneDayAgo, "No successful backup in last 26 hours");

  return results;
}
