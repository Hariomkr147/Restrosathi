import { describe, expect, it } from "vitest";
import { assertSafeSeedEnv } from "./seed-guard";

describe("assertSafeSeedEnv", () => {
  it("allows development without credentials", () => {
    expect(() => assertSafeSeedEnv({ NODE_ENV: "development" })).not.toThrow();
  });

  it("throws if production lacks credentials", () => {
    expect(() => assertSafeSeedEnv({ NODE_ENV: "production" })).toThrow(/required/i);
  });

  it("throws if production uses demo password", () => {
    expect(() => assertSafeSeedEnv({ NODE_ENV: "production", SEED_OWNER_PASSWORD: "demo", SEED_STAFF_PIN: "1234" })).toThrow(/demo/i);
  });

  it("throws if production uses demo pin", () => {
    expect(() => assertSafeSeedEnv({ NODE_ENV: "production", SEED_OWNER_PASSWORD: "real", SEED_STAFF_PIN: "0000" })).toThrow(/demo/i);
  });

  it("allows production with safe credentials", () => {
    expect(() => assertSafeSeedEnv({ NODE_ENV: "production", SEED_OWNER_PASSWORD: "real", SEED_STAFF_PIN: "1234" })).not.toThrow();
  });
});
