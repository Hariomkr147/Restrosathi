export function assertSafeSeedEnv(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production") {
    const ownerPass = env.SEED_OWNER_PASSWORD;
    const staffPin = env.SEED_STAFF_PIN;
    if (!ownerPass || !staffPin) {
      throw new Error("Seed credentials required in production");
    }
    if (ownerPass === "demo" || staffPin === "0000") {
      throw new Error("Cannot use demo credentials in production");
    }
  }
}
