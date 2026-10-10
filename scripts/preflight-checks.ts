/* eslint-disable @typescript-eslint/no-explicit-any */
 
export function checkPreflight(snapshot: any) {
  const results: { name: string, ok: boolean, error: string | null, type: "error" | "warning" }[] = [];
  
  const assert = (name: string, condition: boolean, error: string) => {
    results.push({ name, ok: condition, error: condition ? null : error, type: "error" });
  };
  const warn = (name: string, condition: boolean, error: string) => {
    results.push({ name, ok: condition, error: condition ? null : error, type: "warning" });
  };

  const { env, settings, users, tables, itemCount, lastBackup, demoCredentialResults } = snapshot;

  assert("Environment is production", env.NODE_ENV === "production", "NODE_ENV is not production");
  assert("App URL is secure", (env.APP_URL || "").startsWith("https://"), "APP_URL does not start with https://");
  
  const secrets = ["CRON_SECRET", "OTP_SECRET", "COOKIE_SECRET", "WA_WEBHOOK_SECRET"];
  for (const secret of secrets) {
    const val = env[secret] || "";
    assert(`Secret ${secret} valid`, val.length >= 32 && !val.includes("example"), `${secret} is short or example`);
  }

  assert("Backup encryption key valid", Buffer.from(env.BACKUP_ENCRYPTION_KEY || "", "base64").length === 32, "BACKUP_ENCRYPTION_KEY must be 32 bytes");
  
  assert("No null credentials", !users.some((u: any) => !u.passwordHash && !u.pinHash), "A user has no password/pin hash");
  
  const hasDemoCredentials = demoCredentialResults.some((d: any) => d.hasDemoCredential);
  assert("No demo credentials", !hasDemoCredentials, "Active users exist with default/demo credentials");
  
  assert("Settings name is not demo", settings.name !== "Saffron Tadka" || env.ALLOW_DEMO_NAME === "1", "Restaurant name is the demo name");
  
  // Valid address/phone/owner phone/hours
  assert("Valid address", !!settings.address && settings.address.length > 5, "Address missing or too short");
  assert("Valid phone", /^\+91\d{10}$/.test(settings.phone || ""), "Phone missing or invalid");
  assert("Valid owner phone", /^\+91\d{10}$/.test(settings.ownerPhone || ""), "Owner phone missing or invalid");
  assert("Valid hours", !!settings.hours && settings.hours.length > 10, "Hours missing or too short");

  assert("Tax mode confirmed", settings.taxModeConfirmedAt != null, "Tax mode not confirmed");
  if (settings.taxMode === "REGULAR") {
    assert("GSTIN provided", !!settings.gstin && settings.gstin.length === 15, "REGULAR tax mode requires valid 15-char GSTIN");
  }

  assert("No ALLOW_FAKE_WA", env.ALLOW_FAKE_WA !== "1", "ALLOW_FAKE_WA is enabled");
  assert("Real WhatsApp provider", env.WHATSAPP_PROVIDER === "akg", "WHATSAPP_PROVIDER must be real (akg)");
  
  assert("Tables exist", tables.length > 0, "No active tables");
  assert("Menu items exist", itemCount >= 5, "Fewer than 5 available menu items");

  const oneDayAgo = Date.now() - 26 * 60 * 60 * 1000;
  assert("Recent backup", lastBackup && lastBackup.at.getTime() > oneDayAgo, "No successful backup in last 26 hours");

  // Warnings
  warn("FSSAI provided", !!settings.fssai, "FSSAI license number is recommended but missing");
  warn("AI enabled", env.ENABLE_AI === "1", "AI features are disabled");
  
  assert("Cron URL is set", !!env.CRON_URL, "CRON_URL is not set");

  return results;
}
