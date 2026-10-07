import { describe, it, expect, beforeEach } from "vitest";
import { reportError } from "./errors";
import { prisma } from "./db";
import crypto from "crypto";

describe("reportError", () => {
  beforeEach(async () => {
    await prisma.errorLog.deleteMany({});
  });

  it("creates an ErrorLog row, scrubs phone/email and truncates long messages", async () => {
    const errorMsg = "Payment failed for 9876543210. User test@example.com cannot proceed. " + "x".repeat(350);
    const error = new Error(errorMsg);
    
    await reportError(error, "test-action");
    
    const logs = await prisma.errorLog.findMany();
    expect(logs).toHaveLength(1);
    const log = logs[0];
    
    expect(log.where).toBe("test-action");
    expect(log.message).toContain("[REDACTED_PHONE]");
    expect(log.message).toContain("[REDACTED_EMAIL]");
    expect(log.message).not.toContain("9876543210");
    expect(log.message).not.toContain("test@example.com");
    expect(log.message.length).toBeLessThanOrEqual(303); // 300 + "..."
    expect(log.message.endsWith("...")).toBe(true);
    
    // Check digest
    const expectedDigest = crypto.createHash("sha256").update(error.name + log.message).digest("hex");
    expect(log.digest).toBe(expectedDigest);
  });

  it("groups identical errors with the same digest", async () => {
    await reportError(new Error("Database timeout"), "db-fetch");
    await reportError(new Error("Database timeout"), "db-fetch");
    await reportError("Database timeout", "db-fetch"); // Same message, but name will be "Error" instead of "Error" (from Error object)? Wait, for string it's "Error" as name.
    
    const logs = await prisma.errorLog.findMany();
    expect(logs).toHaveLength(3);
    expect(logs[0].digest).toBe(logs[1].digest);
    expect(logs[1].digest).toBe(logs[2].digest);
  });
});
